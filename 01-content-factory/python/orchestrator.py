"""
LangGraph Orchestrator for Content Factory
Implements the parallel execution graph: topic → (blog, social, adcopy, video) → qa → publish
"""
import asyncio
from datetime import datetime
from typing import Dict, Any, List, Optional, Callable, TypedDict, Annotated, Union, Awaitable
import operator

from langgraph.graph import StateGraph, END

from .models import (
    BrandVoice,
    ContentTopic,
    BlogPost,
    SocialPost,
    AdCopy,
    VideoScript,
    GeneratedContent,
    ContentType,
    ContentStatus,
    ContentRunConfig,
    ContentRunState,
    QAResult,
)
from .agents import (
    TopicAgent,
    BlogAgent,
    SocialAgent,
    AdCopyAgent,
    VideoAgent,
    QAAgent,
)
from .integrations.buffer import BufferPublisher


class GraphState(TypedDict):
    """State passed through the LangGraph nodes"""
    run_id: str
    config: ContentRunConfig
    topics: Annotated[List[ContentTopic], operator.add]
    blog_posts: Annotated[List[BlogPost], operator.add]
    social_posts: Annotated[List[SocialPost], operator.add]
    ad_copies: Annotated[List[AdCopy], operator.add]
    video_scripts: Annotated[List[VideoScript], operator.add]
    generated_content: Annotated[List[GeneratedContent], operator.add]
    qa_results: Dict[str, QAResult]
    errors: Annotated[List[str], operator.add]
    current_step: str
    pieces_generated: int


class ContentFactoryOrchestrator:
    """
    LangGraph-based orchestrator that runs the content factory pipeline.
    
    Graph Structure:
    - start → topic_agent
    - topic_agent → parallel_agents (blog, social, adcopy, video in parallel)
    - parallel_agents → qa_gate
    - qa_gate → publish
    - publish → end
    """
    
    def __init__(
        self,
        on_progress: Optional[Callable[[ContentRunState], Union[None, Awaitable[None]]]] = None,
        on_content_created: Optional[Callable[[int], Union[None, Awaitable[None]]]] = None,
    ):
        self.topic_agent = TopicAgent()
        self.blog_agent = BlogAgent()
        self.social_agent = SocialAgent()
        self.adcopy_agent = AdCopyAgent()
        self.video_agent = VideoAgent()
        self.qa_agent = QAAgent()
        self.publisher = BufferPublisher()
        
        self.on_progress = on_progress
        self.on_content_created = on_content_created
        
        self.graph = self._build_graph()
    
    def _build_graph(self) -> StateGraph:
        """Build the LangGraph execution graph"""
        
        workflow = StateGraph(GraphState)
        
        workflow.add_node("topic_agent", self._topic_node)
        workflow.add_node("blog_agent", self._blog_node)
        workflow.add_node("social_agent", self._social_node)
        workflow.add_node("adcopy_agent", self._adcopy_node)
        workflow.add_node("video_agent", self._video_node)
        workflow.add_node("aggregate", self._aggregate_node)
        workflow.add_node("qa_gate", self._qa_gate_node)
        workflow.add_node("publish", self._publish_node)
        
        workflow.set_entry_point("topic_agent")
        
        workflow.add_edge("topic_agent", "blog_agent")
        workflow.add_edge("topic_agent", "social_agent")
        workflow.add_edge("topic_agent", "adcopy_agent")
        workflow.add_edge("topic_agent", "video_agent")
        
        workflow.add_edge("blog_agent", "aggregate")
        workflow.add_edge("social_agent", "aggregate")
        workflow.add_edge("adcopy_agent", "aggregate")
        workflow.add_edge("video_agent", "aggregate")
        
        workflow.add_edge("aggregate", "qa_gate")
        workflow.add_edge("qa_gate", "publish")
        workflow.add_edge("publish", END)
        
        return workflow.compile()
    
    async def _topic_node(self, state: GraphState) -> Dict[str, Any]:
        """Generate content topics"""
        print(f"[Pipeline] Generating {state['config'].topic_count} topics...")
        
        try:
            topics = await self.topic_agent.generate_topics(
                state["config"].brand_voice,
                count=state["config"].topic_count,
                content_types=state["config"].content_types,
            )
            
            return {
                "topics": topics,
                "current_step": "topic_agent_complete",
            }
        except Exception as e:
            print(f"Topic generation error: {e}")
            return {
                "topics": [],
                "errors": [f"Topic generation failed: {str(e)}"],
                "current_step": "topic_agent_error",
            }
    
    async def _blog_node(self, state: GraphState) -> Dict[str, Any]:
        """Generate blog posts for all topics"""
        print(f"[Pipeline] Generating blog posts...")
        
        blog_posts = []
        generated_content = []
        errors = []
        
        blog_topics = [t for t in state["topics"] 
                       if ContentType.BLOG in t.content_types or 
                       ContentType.BLOG in state["config"].content_types]
        
        for topic in blog_topics:
            try:
                post = await self.blog_agent.generate_blog_post(topic, state["config"].brand_voice)
                blog_posts.append(post)
                generated_content.append(self._to_generated_content(
                    post, state["run_id"], state["config"].brand_voice.client_id, topic.id, ContentType.BLOG
                ))
            except Exception as e:
                errors.append(f"Blog generation failed for {topic.id}: {str(e)}")
        
        if self.on_content_created and len(blog_posts) > 0:
            result = self.on_content_created(len(blog_posts))
            if asyncio.iscoroutine(result):
                await result
        
        return {
            "blog_posts": blog_posts,
            "generated_content": generated_content,
            "errors": errors,
        }
    
    async def _social_node(self, state: GraphState) -> Dict[str, Any]:
        """Generate social media posts for all topics"""
        print(f"[Pipeline] Generating social posts...")
        
        social_posts = []
        generated_content = []
        errors = []
        
        for topic in state["topics"]:
            try:
                posts = await self.social_agent.generate_from_topic(topic, state["config"].brand_voice)
                social_posts.extend(posts)
                
                for post in posts:
                    ct = ContentType.LINKEDIN if post.platform == "linkedin" else \
                         ContentType.TWITTER if post.platform == "twitter" else ContentType.INSTAGRAM
                    generated_content.append(self._to_generated_content(
                        post, state["run_id"], state["config"].brand_voice.client_id, topic.id, ct
                    ))
            except Exception as e:
                errors.append(f"Social generation failed for {topic.id}: {str(e)}")
        
        if self.on_content_created and len(social_posts) > 0:
            result = self.on_content_created(len(social_posts))
            if asyncio.iscoroutine(result):
                await result
        
        return {
            "social_posts": social_posts,
            "generated_content": generated_content,
            "errors": errors,
        }
    
    async def _adcopy_node(self, state: GraphState) -> Dict[str, Any]:
        """Generate ad copies for all topics"""
        print(f"[Pipeline] Generating ad copies...")
        
        ad_copies = []
        generated_content = []
        errors = []
        
        for topic in state["topics"]:
            try:
                ads = await self.adcopy_agent.generate_all_ads(topic, state["config"].brand_voice)
                ad_copies.extend(ads)
                
                for ad in ads:
                    ct = ContentType.GOOGLE_AD if ad.platform == "google" else ContentType.FACEBOOK_AD
                    generated_content.append(self._to_generated_content(
                        ad, state["run_id"], state["config"].brand_voice.client_id, topic.id, ct
                    ))
            except Exception as e:
                errors.append(f"Ad copy generation failed for {topic.id}: {str(e)}")
        
        if self.on_content_created and len(ad_copies) > 0:
            result = self.on_content_created(len(ad_copies))
            if asyncio.iscoroutine(result):
                await result
        
        return {
            "ad_copies": ad_copies,
            "generated_content": generated_content,
            "errors": errors,
        }
    
    async def _video_node(self, state: GraphState) -> Dict[str, Any]:
        """Generate video scripts for all topics"""
        print(f"[Pipeline] Generating video scripts...")
        
        video_scripts = []
        generated_content = []
        errors = []
        
        video_topics = [t for t in state["topics"] 
                        if ContentType.VIDEO_SCRIPT in t.content_types or 
                        ContentType.VIDEO_SCRIPT in state["config"].content_types]
        
        for topic in video_topics:
            try:
                script = await self.video_agent.generate_script(topic, state["config"].brand_voice)
                video_scripts.append(script)
                generated_content.append(self._to_generated_content(
                    script, state["run_id"], state["config"].brand_voice.client_id, topic.id, ContentType.VIDEO_SCRIPT
                ))
            except Exception as e:
                errors.append(f"Video generation failed for {topic.id}: {str(e)}")
        
        if self.on_content_created and len(video_scripts) > 0:
            result = self.on_content_created(len(video_scripts))
            if asyncio.iscoroutine(result):
                await result
        
        return {
            "video_scripts": video_scripts,
            "generated_content": generated_content,
            "errors": errors,
        }
    
    async def _aggregate_node(self, state: GraphState) -> Dict[str, Any]:
        """Aggregate all generated content"""
        print(f"[Pipeline] Aggregating content...")
        
        pieces = len(state.get("generated_content", []))
        print(f"[Pipeline] Total pieces generated: {pieces}")
        
        return {
            "pieces_generated": pieces,
            "current_step": "aggregate_complete",
        }
    
    async def _qa_gate_node(self, state: GraphState) -> Dict[str, Any]:
        """Run QA review on all generated content"""
        print(f"[Pipeline] Running QA review on {len(state.get('generated_content', []))} pieces...")
        
        content_list = state.get("generated_content", [])
        if not content_list:
            return {"qa_results": {}, "current_step": "qa_gate_complete"}
        
        qa_results = await self.qa_agent.review_batch(
            content_list,
            state["config"].brand_voice,
        )
        
        for content in content_list:
            qa_result = qa_results.get(content.id)
            if qa_result:
                content.qa_score = qa_result.score
                content.qa_feedback = qa_result.feedback
                content.status = ContentStatus.PENDING_REVIEW if qa_result.passed else ContentStatus.REJECTED
                
                if qa_result.passed:
                    await self.qa_agent.send_slack_approval(
                        content,
                        qa_result,
                        state["config"].client_name,
                    )
        
        passed = sum(1 for r in qa_results.values() if r.passed)
        print(f"[Pipeline] QA complete: {passed}/{len(qa_results)} passed")
        
        return {
            "qa_results": qa_results,
            "generated_content": content_list,
            "current_step": "qa_gate_complete",
        }
    
    async def _publish_node(self, state: GraphState) -> Dict[str, Any]:
        """Auto-publish approved content to Buffer"""
        print("[Pipeline] Publishing approved content...")
        
        content_list = state.get("generated_content", [])
        approved = [c for c in content_list if c.status == ContentStatus.APPROVED]
        
        for content in approved:
            success = await self.publisher.publish(content)
            if success:
                content.status = ContentStatus.PUBLISHED
        
        print(f"[Pipeline] Published {len(approved)} pieces")
        
        return {
            "generated_content": content_list,
            "current_step": "publish_complete",
        }
    
    def _to_generated_content(
        self,
        item: Any,
        run_id: str,
        client_id: str,
        topic_id: str,
        content_type: ContentType,
    ) -> GeneratedContent:
        """Convert agent output to GeneratedContent"""
        
        if isinstance(item, BlogPost):
            return GeneratedContent(
                id=item.id,
                run_id=run_id,
                client_id=client_id,
                topic_id=topic_id,
                content_type=content_type,
                title=item.title,
                content=item.content,
                metadata={
                    "meta_description": item.meta_description,
                    "headings": item.headings,
                    "word_count": item.word_count,
                    "cta": item.cta,
                },
            )
        
        elif isinstance(item, SocialPost):
            return GeneratedContent(
                id=item.id,
                run_id=run_id,
                client_id=client_id,
                topic_id=topic_id,
                content_type=content_type,
                title=f"{item.platform.title()} Post",
                content=item.content,
                metadata={
                    "platform": item.platform,
                    "hashtags": item.hashtags,
                    "media_prompt": item.media_prompt,
                    "carousel_slides": item.carousel_slides,
                },
            )
        
        elif isinstance(item, AdCopy):
            return GeneratedContent(
                id=item.id,
                run_id=run_id,
                client_id=client_id,
                topic_id=topic_id,
                content_type=content_type,
                title=item.headlines[0] if item.headlines else "Ad Copy",
                content="\n".join(item.descriptions),
                metadata={
                    "platform": item.platform,
                    "headlines": item.headlines,
                    "descriptions": item.descriptions,
                    "cta": item.cta,
                    "target_audience": item.target_audience,
                },
            )
        
        elif isinstance(item, VideoScript):
            return GeneratedContent(
                id=item.id,
                run_id=run_id,
                client_id=client_id,
                topic_id=topic_id,
                content_type=content_type,
                title=item.hook,
                content=item.script,
                metadata={
                    "hook": item.hook,
                    "duration_seconds": item.duration_seconds,
                    "cta": item.cta,
                    "voiceover_url": item.voiceover_url,
                    "video_url": item.video_url,
                },
                media_urls=[item.video_url] if item.video_url else [],
            )
        
        else:
            return GeneratedContent(
                id=f"content_{topic_id}",
                run_id=run_id,
                client_id=client_id,
                topic_id=topic_id,
                content_type=content_type,
                title="Generated Content",
                content=str(item),
            )
    
    async def run(self, config: ContentRunConfig) -> ContentRunState:
        """Execute the full content factory pipeline using LangGraph"""
        
        run_id = f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{config.client_id}"
        
        initial_state: GraphState = {
            "run_id": run_id,
            "config": config,
            "topics": [],
            "blog_posts": [],
            "social_posts": [],
            "ad_copies": [],
            "video_scripts": [],
            "generated_content": [],
            "qa_results": {},
            "errors": [],
            "current_step": "start",
            "pieces_generated": 0,
        }
        
        print(f"[Pipeline] Starting run {run_id} for {config.client_name}")
        
        final_state = await self.graph.ainvoke(initial_state)
        
        result = ContentRunState(
            run_id=run_id,
            config=config,
            topics=final_state.get("topics", []),
            blog_posts=final_state.get("blog_posts", []),
            social_posts=final_state.get("social_posts", []),
            ad_copies=final_state.get("ad_copies", []),
            video_scripts=final_state.get("video_scripts", []),
            generated_content=final_state.get("generated_content", []),
            qa_results=final_state.get("qa_results", {}),
            status="completed",
            total_pieces=final_state.get("pieces_generated", 0),
            passed_pieces=sum(1 for r in final_state.get("qa_results", {}).values() if r.passed),
            failed_pieces=sum(1 for r in final_state.get("qa_results", {}).values() if not r.passed),
            errors=final_state.get("errors", []),
            started_at=datetime.now(),
            completed_at=datetime.now(),
        )
        
        if self.on_progress:
            progress_result = self.on_progress(result)
            if asyncio.iscoroutine(progress_result):
                await progress_result
        
        print(f"[Pipeline] Run complete: {result.total_pieces} pieces, {result.passed_pieces} passed")
        
        return result


async def run_content_factory(
    config: ContentRunConfig,
    on_progress: Optional[Callable[[ContentRunState], Union[None, Awaitable[None]]]] = None,
    on_content_created: Optional[Callable[[int], Union[None, Awaitable[None]]]] = None,
) -> ContentRunState:
    """Convenience function to run the content factory pipeline"""
    orchestrator = ContentFactoryOrchestrator(
        on_progress=on_progress,
        on_content_created=on_content_created,
    )
    return await orchestrator.run(config)
