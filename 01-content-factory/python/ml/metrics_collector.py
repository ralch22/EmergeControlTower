"""
Metrics Collector for Agent Performance Monitoring
Collects and stores metrics from agents for anomaly detection
"""
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from collections import defaultdict
from threading import Lock

import numpy as np
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class MetricRecord(BaseModel):
    """A single metric record"""
    agent_slug: str
    metric_type: str
    value: float
    unit: str
    context: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.now)


class BaselineStats(BaseModel):
    """Baseline statistics for a metric"""
    mean: float
    std: float
    min: float
    max: float
    median: float
    count: int
    last_updated: datetime = Field(default_factory=datetime.now)


class MetricsCollector:
    """
    Collects and stores metrics from agents for anomaly detection.
    
    Stores metrics in-memory with thread-safe operations.
    Designed to be synced to database via API for persistence.
    """
    
    def __init__(self, max_records_per_agent: int = 10000):
        """
        Initialize the metrics collector.
        
        Args:
            max_records_per_agent: Maximum number of records to keep per agent
        """
        self.max_records_per_agent = max_records_per_agent
        
        self._metrics: Dict[str, List[MetricRecord]] = defaultdict(list)
        self._lock = Lock()
        self._registered_agents: set = set()
        
        logger.info(
            f"MetricsCollector initialized with max_records_per_agent={max_records_per_agent}"
        )
    
    def record_metric(
        self,
        agent_slug: str,
        metric_type: str,
        value: float,
        unit: str = "",
        context: Dict[str, Any] = None,
    ) -> MetricRecord:
        """
        Record a single metric for an agent.
        
        Args:
            agent_slug: Unique identifier for the agent
            metric_type: Type of metric (qa_score, api_failure_rate, etc.)
            value: Numeric value of the metric
            unit: Unit of measurement (ms, %, count, etc.)
            context: Additional context information
            
        Returns:
            The recorded MetricRecord
        """
        context = context or {}
        
        record = MetricRecord(
            agent_slug=agent_slug,
            metric_type=metric_type,
            value=value,
            unit=unit,
            context=context,
        )
        
        with self._lock:
            self._registered_agents.add(agent_slug)
            self._metrics[agent_slug].append(record)
            
            if len(self._metrics[agent_slug]) > self.max_records_per_agent:
                excess = len(self._metrics[agent_slug]) - self.max_records_per_agent
                self._metrics[agent_slug] = self._metrics[agent_slug][excess:]
                logger.debug(
                    f"Trimmed {excess} old records for agent {agent_slug}"
                )
        
        logger.debug(
            f"Recorded metric for {agent_slug}: {metric_type}={value}{unit}"
        )
        
        return record
    
    def get_agent_metrics(
        self,
        agent_slug: str,
        hours: int = 24,
        metric_type: Optional[str] = None,
    ) -> List[dict]:
        """
        Get recent metrics for an agent.
        
        Args:
            agent_slug: Unique identifier for the agent
            hours: Number of hours to look back (default: 24)
            metric_type: Optional filter by metric type
            
        Returns:
            List of metric dictionaries
        """
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        with self._lock:
            agent_records = self._metrics.get(agent_slug, [])
            
            filtered_records = [
                record for record in agent_records
                if record.timestamp >= cutoff_time
            ]
            
            if metric_type:
                filtered_records = [
                    record for record in filtered_records
                    if record.metric_type == metric_type
                ]
        
        return [
            {
                "agent_slug": record.agent_slug,
                "metric_type": record.metric_type,
                "value": record.value,
                "unit": record.unit,
                "context": record.context,
                "timestamp": record.timestamp.isoformat(),
            }
            for record in filtered_records
        ]
    
    def calculate_baseline(
        self,
        agent_slug: str,
        metric_type: str,
        hours: int = 168,
    ) -> Dict[str, Any]:
        """
        Calculate baseline statistics for an agent's metric.
        
        Args:
            agent_slug: Unique identifier for the agent
            metric_type: Type of metric to calculate baseline for
            hours: Number of hours to include in baseline (default: 168 = 1 week)
            
        Returns:
            Dictionary with baseline statistics
        """
        metrics = self.get_agent_metrics(agent_slug, hours=hours, metric_type=metric_type)
        
        if not metrics:
            logger.warning(
                f"No metrics found for {agent_slug}/{metric_type} in last {hours} hours"
            )
            return {
                "mean": 0.0,
                "std": 0.0,
                "min": 0.0,
                "max": 0.0,
                "median": 0.0,
                "count": 0,
                "error": "No metrics found",
            }
        
        values = [m["value"] for m in metrics]
        values_array = np.array(values)
        
        baseline = BaselineStats(
            mean=float(np.mean(values_array)),
            std=float(np.std(values_array)),
            min=float(np.min(values_array)),
            max=float(np.max(values_array)),
            median=float(np.median(values_array)),
            count=len(values),
        )
        
        logger.info(
            f"Calculated baseline for {agent_slug}/{metric_type}: "
            f"mean={baseline.mean:.2f}, std={baseline.std:.2f}, count={baseline.count}"
        )
        
        return baseline.model_dump()
    
    def get_all_agent_slugs(self) -> List[str]:
        """Get list of all registered agent slugs."""
        with self._lock:
            return list(self._registered_agents)
    
    def get_metric_types_for_agent(self, agent_slug: str) -> List[str]:
        """Get list of all metric types recorded for an agent."""
        with self._lock:
            records = self._metrics.get(agent_slug, [])
            return list(set(record.metric_type for record in records))
    
    def get_metrics_summary(self, agent_slug: str) -> Dict[str, Any]:
        """
        Get a summary of all metrics for an agent.
        
        Args:
            agent_slug: Unique identifier for the agent
            
        Returns:
            Dictionary with summary for each metric type
        """
        metric_types = self.get_metric_types_for_agent(agent_slug)
        
        summary = {}
        for metric_type in metric_types:
            baseline = self.calculate_baseline(agent_slug, metric_type)
            recent = self.get_agent_metrics(agent_slug, hours=1, metric_type=metric_type)
            
            summary[metric_type] = {
                "baseline": baseline,
                "recent_count": len(recent),
                "latest_value": recent[-1]["value"] if recent else None,
            }
        
        return summary
    
    def clear_agent_metrics(self, agent_slug: str) -> int:
        """
        Clear all metrics for an agent.
        
        Args:
            agent_slug: Unique identifier for the agent
            
        Returns:
            Number of records cleared
        """
        with self._lock:
            count = len(self._metrics.get(agent_slug, []))
            if agent_slug in self._metrics:
                del self._metrics[agent_slug]
            if agent_slug in self._registered_agents:
                self._registered_agents.remove(agent_slug)
        
        logger.info(f"Cleared {count} metrics for agent {agent_slug}")
        return count
    
    def export_for_training(
        self,
        agent_slug: Optional[str] = None,
        hours: int = 168,
    ) -> List[dict]:
        """
        Export metrics in format suitable for training anomaly detector.
        
        Args:
            agent_slug: Optional filter by agent
            hours: Number of hours to export
            
        Returns:
            List of metric dictionaries for training
        """
        all_metrics = []
        
        with self._lock:
            agents = [agent_slug] if agent_slug else list(self._registered_agents)
        
        for agent in agents:
            metrics = self.get_agent_metrics(agent, hours=hours)
            all_metrics.extend(metrics)
        
        logger.info(f"Exported {len(all_metrics)} metrics for training")
        return all_metrics
