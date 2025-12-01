import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Play, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Clock,
  Wrench,
  Activity,
  FileText,
  Zap,
  TrendingUp
} from "lucide-react";

interface TestResult {
  testName: string;
  category: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  duration: number;
  error?: string;
  timestamp: string;
}

interface FeatureHealth {
  feature: string;
  category: string;
  path: string;
  status: 'working' | 'broken' | 'degraded' | 'unknown';
  lastTested: string;
  errorMessage?: string;
  suggestedFix?: string;
}

interface TestRunResult {
  runId: string;
  timestamp: string;
  duration: number;
  results: TestResult[];
  featureHealth: FeatureHealth[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    passRate: number;
  };
  brokenFeatures: {
    feature: string;
    category: string;
    path: string;
    error: string;
    suggestedFix: string;
  }[];
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: "default" | "destructive" | "secondary" | "outline"; icon: React.ReactNode }> = {
    passed: { variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
    working: { variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
    failed: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
    broken: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
    degraded: { variant: "secondary", icon: <AlertTriangle className="h-3 w-3" /> },
    skipped: { variant: "outline", icon: <Clock className="h-3 w-3" /> },
    unknown: { variant: "outline", icon: <AlertTriangle className="h-3 w-3" /> },
    pending: { variant: "outline", icon: <Clock className="h-3 w-3" /> },
  };

  const config = variants[status] || variants.unknown;

  return (
    <Badge variant={config.variant} className="flex items-center gap-1" data-testid={`status-badge-${status}`}>
      {config.icon}
      {status}
    </Badge>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    core: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    video: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    content: "bg-green-500/10 text-green-500 border-green-500/20",
    quality: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    brand: "bg-pink-500/10 text-pink-500 border-pink-500/20",
    system: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    runway: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    ai: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
    providers: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  };

  return (
    <Badge variant="outline" className={colors[category] || colors.system}>
      {category}
    </Badge>
  );
}

export default function TestRunner() {
  const [isRunning, setIsRunning] = useState(false);
  const queryClient = useQueryClient();

  const { data: lastRun, isLoading } = useQuery<TestRunResult | { message: string; lastRun: null }>({
    queryKey: ["/api/tests/last-run"],
  });

  const { data: history } = useQuery<{ runs: TestRunResult[]; total: number }>({
    queryKey: ["/api/tests/history"],
  });

  const runTests = useMutation({
    mutationFn: async () => {
      setIsRunning(true);
      const response = await fetch("/api/tests/run");
      if (!response.ok) throw new Error("Test run failed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests/last-run"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tests/history"] });
      setIsRunning(false);
    },
    onError: () => {
      setIsRunning(false);
    },
  });

  const testResults = lastRun && 'results' in lastRun ? lastRun : null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="page-title">Test Runner</h1>
          <p className="text-muted-foreground">
            Run comprehensive tests across all pages and APIs to identify broken features
          </p>
        </div>
        <Button 
          onClick={() => runTests.mutate()} 
          disabled={isRunning}
          size="lg"
          data-testid="run-tests-button"
        >
          {isRunning ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Running Tests...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run All Tests
            </>
          )}
        </Button>
      </div>

      {testResults && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Total Tests
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="total-tests">
                  {testResults.summary.total}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-500">
                  <CheckCircle2 className="h-4 w-4" />
                  Passed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500" data-testid="passed-tests">
                  {testResults.summary.passed}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-500">
                  <XCircle className="h-4 w-4" />
                  Failed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500" data-testid="failed-tests">
                  {testResults.summary.failed}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Pass Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="pass-rate">
                  {testResults.summary.passRate.toFixed(1)}%
                </div>
                <Progress 
                  value={testResults.summary.passRate} 
                  className="mt-2"
                />
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="broken" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="broken" className="flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Broken Features ({testResults.brokenFeatures.length})
              </TabsTrigger>
              <TabsTrigger value="results" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                All Results
              </TabsTrigger>
              <TabsTrigger value="health" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Feature Health
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="broken" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-red-500" />
                    Broken Features Requiring Attention
                  </CardTitle>
                  <CardDescription>
                    These features failed testing and need to be fixed
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {testResults.brokenFeatures.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                      <p className="text-lg font-medium">All features are working!</p>
                      <p>No broken features detected in the last test run.</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-4">
                        {testResults.brokenFeatures.map((feature, index) => (
                          <div key={index} className="border rounded-lg p-4 space-y-2" data-testid={`broken-feature-${index}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <XCircle className="h-4 w-4 text-red-500" />
                                <span className="font-medium">{feature.feature}</span>
                              </div>
                              <CategoryBadge category={feature.category} />
                            </div>
                            <div className="text-sm text-muted-foreground">
                              <span className="font-medium">Path:</span> {feature.path}
                            </div>
                            <div className="text-sm text-red-500">
                              <span className="font-medium">Error:</span> {feature.error}
                            </div>
                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-3 text-sm">
                              <div className="flex items-center gap-2 font-medium text-yellow-600 mb-1">
                                <Zap className="h-4 w-4" />
                                Suggested Fix
                              </div>
                              <p className="text-yellow-700 dark:text-yellow-400">
                                {feature.suggestedFix}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="results" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Test Results</CardTitle>
                  <CardDescription>
                    Detailed results from the last test run
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {testResults.results.map((result, index) => (
                        <div 
                          key={index} 
                          className="flex items-center justify-between p-3 border rounded-lg"
                          data-testid={`test-result-${index}`}
                        >
                          <div className="flex items-center gap-3">
                            <StatusBadge status={result.status} />
                            <span className="font-medium">{result.testName}</span>
                            <CategoryBadge category={result.category} />
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{result.duration}ms</span>
                            {result.error && (
                              <span className="text-red-500 max-w-xs truncate" title={result.error}>
                                {result.error}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="health" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Feature Health Overview</CardTitle>
                  <CardDescription>
                    Status of all features and pages
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {testResults.featureHealth.map((feature, index) => (
                        <div 
                          key={index} 
                          className="border rounded-lg p-3 space-y-2"
                          data-testid={`feature-health-${index}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{feature.feature}</span>
                            <StatusBadge status={feature.status} />
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CategoryBadge category={feature.category} />
                            <span>{feature.path}</span>
                          </div>
                          {feature.suggestedFix && (
                            <div className="text-xs text-yellow-600 dark:text-yellow-400">
                              {feature.suggestedFix}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Test Run History</CardTitle>
                  <CardDescription>
                    Previous test runs and their results
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {history?.runs && history.runs.length > 0 ? (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2">
                        {history.runs.map((run, index) => (
                          <div 
                            key={run.runId} 
                            className="flex items-center justify-between p-3 border rounded-lg"
                            data-testid={`history-run-${index}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-sm">{run.runId}</span>
                              <span className="text-sm text-muted-foreground">
                                {new Date(run.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-green-500">
                                {run.summary.passed} passed
                              </span>
                              <span className="text-red-500">
                                {run.summary.failed} failed
                              </span>
                              <span className="font-medium">
                                {run.summary.passRate.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-12 w-12 mx-auto mb-4" />
                      <p>No test history available yet.</p>
                      <p>Run tests to build up a history.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {!testResults && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Activity className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Test Results Yet</h2>
            <p className="text-muted-foreground mb-4">
              Click "Run All Tests" to start testing all pages and API endpoints
            </p>
            <Button onClick={() => runTests.mutate()} disabled={isRunning}>
              <Play className="h-4 w-4 mr-2" />
              Run Tests Now
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
