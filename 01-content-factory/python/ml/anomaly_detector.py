"""
Anomaly Detection Service using Isolation Forest
Detects anomalies in agent metrics and suggests remediation actions
"""
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

import numpy as np
from sklearn.ensemble import IsolationForest
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class MetricType(str, Enum):
    QA_SCORE = "qa_score"
    API_FAILURE_RATE = "api_failure_rate"
    RESPONSE_TIME = "response_time"
    COST = "cost"
    THROUGHPUT = "throughput"


class SuggestedAction(str, Enum):
    RETRAIN = "retrain"
    RESTART = "restart"
    INVESTIGATE = "investigate"
    SCALE_DOWN = "scale_down"
    SCALE_UP = "scale_up"
    NO_ACTION = "no_action"


class AnomalyResult(BaseModel):
    """Result of anomaly detection for a single metric"""
    metric_type: MetricType
    current_value: float
    expected_value: float
    anomaly_score: float = Field(ge=-1.0, le=1.0)
    is_anomaly: bool
    suggested_action: SuggestedAction
    confidence: float = Field(ge=0.0, le=1.0)
    timestamp: datetime = Field(default_factory=datetime.now)
    context: Dict[str, Any] = Field(default_factory=dict)


class AnomalyDetector:
    """
    Anomaly detector using scikit-learn's Isolation Forest algorithm.
    
    Isolation Forest is effective for detecting outliers in high-dimensional
    datasets and works well for detecting anomalies in agent metrics.
    """
    
    METRIC_THRESHOLDS = {
        MetricType.QA_SCORE: {"min": 6.0, "max": 10.0, "direction": "higher_is_better"},
        MetricType.API_FAILURE_RATE: {"min": 0.0, "max": 0.1, "direction": "lower_is_better"},
        MetricType.RESPONSE_TIME: {"min": 0.0, "max": 5000.0, "direction": "lower_is_better"},
        MetricType.COST: {"min": 0.0, "max": 100.0, "direction": "lower_is_better"},
        MetricType.THROUGHPUT: {"min": 0.0, "max": 1000.0, "direction": "higher_is_better"},
    }
    
    def __init__(
        self,
        contamination: float = 0.1,
        n_estimators: int = 100,
        random_state: int = 42,
    ):
        """
        Initialize the anomaly detector.
        
        Args:
            contamination: Expected proportion of outliers in the dataset
            n_estimators: Number of base estimators in the ensemble
            random_state: Seed for reproducibility
        """
        self.contamination = contamination
        self.n_estimators = n_estimators
        self.random_state = random_state
        
        self._models: Dict[MetricType, IsolationForest] = {}
        self._baselines: Dict[MetricType, Dict[str, float]] = {}
        self._is_trained: Dict[MetricType, bool] = {mt: False for mt in MetricType}
        
        logger.info(
            f"AnomalyDetector initialized with contamination={contamination}, "
            f"n_estimators={n_estimators}"
        )
    
    def train(self, metrics: List[dict]) -> Dict[MetricType, bool]:
        """
        Train the Isolation Forest models on historical metrics.
        
        Args:
            metrics: List of metric dictionaries with 'metric_type' and 'value' keys
            
        Returns:
            Dictionary mapping metric types to training success status
        """
        if not metrics:
            logger.warning("No metrics provided for training")
            return {mt: False for mt in MetricType}
        
        grouped_metrics: Dict[MetricType, List[float]] = {mt: [] for mt in MetricType}
        
        for metric in metrics:
            try:
                metric_type = MetricType(metric.get("metric_type", ""))
                value = float(metric.get("value", 0))
                grouped_metrics[metric_type].append(value)
            except (ValueError, TypeError) as e:
                logger.debug(f"Skipping invalid metric: {metric}, error: {e}")
                continue
        
        training_results = {}
        
        for metric_type, values in grouped_metrics.items():
            if len(values) < 10:
                logger.warning(
                    f"Insufficient data for {metric_type.value}: "
                    f"got {len(values)}, need at least 10"
                )
                training_results[metric_type] = False
                continue
            
            try:
                values_array = np.array(values).reshape(-1, 1)
                
                self._baselines[metric_type] = {
                    "mean": float(np.mean(values)),
                    "std": float(np.std(values)),
                    "min": float(np.min(values)),
                    "max": float(np.max(values)),
                    "median": float(np.median(values)),
                }
                
                model = IsolationForest(
                    contamination=self.contamination,
                    n_estimators=self.n_estimators,
                    random_state=self.random_state,
                    n_jobs=-1,
                )
                model.fit(values_array)
                
                self._models[metric_type] = model
                self._is_trained[metric_type] = True
                training_results[metric_type] = True
                
                logger.info(
                    f"Trained model for {metric_type.value} with {len(values)} samples. "
                    f"Baseline: mean={self._baselines[metric_type]['mean']:.2f}, "
                    f"std={self._baselines[metric_type]['std']:.2f}"
                )
                
            except Exception as e:
                logger.error(f"Failed to train model for {metric_type.value}: {e}")
                training_results[metric_type] = False
        
        return training_results
    
    def detect_anomalies(self, metrics: List[dict]) -> List[AnomalyResult]:
        """
        Detect anomalies in new metric data.
        
        Args:
            metrics: List of metric dictionaries with 'metric_type' and 'value' keys
            
        Returns:
            List of AnomalyResult objects for detected anomalies
        """
        results: List[AnomalyResult] = []
        
        for metric in metrics:
            try:
                metric_type = MetricType(metric.get("metric_type", ""))
                value = float(metric.get("value", 0))
                context = metric.get("context", {})
                
                result = self._detect_single(metric_type, value, context)
                results.append(result)
                
            except (ValueError, TypeError) as e:
                logger.debug(f"Skipping invalid metric: {metric}, error: {e}")
                continue
        
        return results
    
    def _detect_single(
        self,
        metric_type: MetricType,
        value: float,
        context: Dict[str, Any] = None,
    ) -> AnomalyResult:
        """Detect anomaly for a single metric value."""
        context = context or {}
        
        if not self._is_trained.get(metric_type, False):
            baseline = self._baselines.get(metric_type, {})
            expected_value = baseline.get("mean", 0.0)
            
            is_anomaly = self._check_threshold_violation(metric_type, value)
            anomaly_score = -1.0 if is_anomaly else 1.0
            
            suggested_action = self.get_suggested_action(
                metric_type.value, anomaly_score, value, expected_value
            )
            
            return AnomalyResult(
                metric_type=metric_type,
                current_value=value,
                expected_value=expected_value,
                anomaly_score=anomaly_score,
                is_anomaly=is_anomaly,
                suggested_action=suggested_action,
                confidence=0.5,
                context=context,
            )
        
        model = self._models[metric_type]
        baseline = self._baselines[metric_type]
        
        value_array = np.array([[value]])
        prediction = model.predict(value_array)[0]
        score = model.decision_function(value_array)[0]
        
        anomaly_score = float(np.clip(score, -1.0, 1.0))
        is_anomaly = prediction == -1
        
        expected_value = baseline["mean"]
        confidence = self._calculate_confidence(score, baseline)
        
        suggested_action = self.get_suggested_action(
            metric_type.value, anomaly_score, value, expected_value
        )
        
        if is_anomaly:
            logger.info(
                f"Anomaly detected for {metric_type.value}: "
                f"value={value:.2f}, expected={expected_value:.2f}, "
                f"score={anomaly_score:.2f}, action={suggested_action.value}"
            )
        
        return AnomalyResult(
            metric_type=metric_type,
            current_value=value,
            expected_value=expected_value,
            anomaly_score=anomaly_score,
            is_anomaly=is_anomaly,
            suggested_action=suggested_action,
            confidence=confidence,
            context=context,
        )
    
    def _check_threshold_violation(self, metric_type: MetricType, value: float) -> bool:
        """Check if value violates predefined thresholds."""
        thresholds = self.METRIC_THRESHOLDS.get(metric_type, {})
        min_val = thresholds.get("min", float("-inf"))
        max_val = thresholds.get("max", float("inf"))
        
        return value < min_val or value > max_val
    
    def _calculate_confidence(
        self,
        score: float,
        baseline: Dict[str, float],
    ) -> float:
        """Calculate confidence level based on score and baseline stats."""
        std = baseline.get("std", 1.0)
        if std == 0:
            std = 1.0
        
        normalized_score = abs(score)
        confidence = min(1.0, normalized_score / 0.5)
        
        return float(confidence)
    
    def get_suggested_action(
        self,
        metric_type: str,
        anomaly_score: float,
        current_value: float,
        expected_value: float,
    ) -> SuggestedAction:
        """
        Suggest remediation action based on metric type and anomaly characteristics.
        
        Args:
            metric_type: Type of metric (qa_score, api_failure_rate, etc.)
            anomaly_score: Score from Isolation Forest (-1 to 1, lower = more anomalous)
            current_value: Current observed value
            expected_value: Expected/baseline value
            
        Returns:
            Suggested action enum value
        """
        if anomaly_score > 0:
            return SuggestedAction.NO_ACTION
        
        try:
            mt = MetricType(metric_type)
        except ValueError:
            return SuggestedAction.INVESTIGATE
        
        thresholds = self.METRIC_THRESHOLDS.get(mt, {})
        direction = thresholds.get("direction", "lower_is_better")
        
        if expected_value != 0:
            deviation = (current_value - expected_value) / abs(expected_value)
        else:
            deviation = current_value
        
        if mt == MetricType.QA_SCORE:
            if current_value < 6.0:
                return SuggestedAction.RETRAIN
            elif current_value < 7.0:
                return SuggestedAction.INVESTIGATE
            return SuggestedAction.NO_ACTION
        
        elif mt == MetricType.API_FAILURE_RATE:
            if current_value > 0.3:
                return SuggestedAction.RESTART
            elif current_value > 0.15:
                return SuggestedAction.INVESTIGATE
            return SuggestedAction.NO_ACTION
        
        elif mt == MetricType.RESPONSE_TIME:
            if current_value > expected_value * 3:
                return SuggestedAction.SCALE_UP
            elif current_value > expected_value * 1.5:
                return SuggestedAction.INVESTIGATE
            elif current_value < expected_value * 0.3 and current_value < 100:
                return SuggestedAction.SCALE_DOWN
            return SuggestedAction.NO_ACTION
        
        elif mt == MetricType.COST:
            if current_value > expected_value * 2:
                return SuggestedAction.INVESTIGATE
            elif current_value < expected_value * 0.3:
                return SuggestedAction.SCALE_DOWN
            return SuggestedAction.NO_ACTION
        
        elif mt == MetricType.THROUGHPUT:
            if current_value < expected_value * 0.5:
                return SuggestedAction.SCALE_UP
            elif current_value > expected_value * 2:
                return SuggestedAction.INVESTIGATE
            return SuggestedAction.NO_ACTION
        
        return SuggestedAction.INVESTIGATE
    
    def get_baseline(self, metric_type: MetricType) -> Optional[Dict[str, float]]:
        """Get the baseline statistics for a metric type."""
        return self._baselines.get(metric_type)
    
    def is_trained(self, metric_type: MetricType) -> bool:
        """Check if a model is trained for the given metric type."""
        return self._is_trained.get(metric_type, False)
