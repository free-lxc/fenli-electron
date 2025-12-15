/**
 * 依赖分析工具 - 主应用组件 (Electron 版本)
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  Card,
  Input,
  Button,
  message,
  Spin,
  Tabs,
  Statistic,
  Row,
  Col,
  Alert,
} from 'antd';
import {
  FileSearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons';
import {
  analyzeDependencies,
  analyzeDependenciesBatch,
  selectAndAnalyzeZip,
  selectProjectDirectory,
  selectEntryFile,
} from './services';
import DirectoryTreeView from './components/DirectoryTreeView';
import DependencyGraphView from './components/DependencyGraphView';
import DirectoryTree from './components/DirectoryTree';
import './App.less';

const { TextArea } = Input;
const { TabPane } = Tabs;

const App = () => {
  const [mode, setMode] = useState('path');
  const [entryFile, setEntryFile] = useState('');
  const [entryFiles, setEntryFiles] = useState(''); // 多入口文件（每行一个）
  const [projectRoot, setProjectRoot] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    entryFile: string;
    statistics: {
      totalFiles: number;
      totalDependencies: number;
      filesByType: { js: number; ts: number; tsx: number };
    };
    directoryTree: string;
    dependencyGraph: Record<string, string[]>;
    entryResults?: Array<{
      entryFile: string;
      statistics: {
        totalFiles: number;
        totalDependencies: number;
        filesByType: { js: number; ts: number; tsx: number };
      };
      dependencyGraph: Record<string, string[]>;
    }>;
  } | null>(null);
  const [activeTab, setActiveTab] = useState('tree');
  const [directoryTree, setDirectoryTree] = useState<{
    name: string;
    path: string;
    children: unknown[];
  } | null>(null);
  const [uploadProjectRoot, setUploadProjectRoot] = useState<string | null>(null);
  const [excludeDirs, setExcludeDirs] = useState('');
  const [invalidEntries, setInvalidEntries] = useState<string[]>([]);
  const [errorInfo, setErrorInfo] = useState<{
    type?: string;
    message?: string;
    details?: string;
  } | null>(null);

  // 添加全局错误处理
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      console.error('未处理的 Promise 拒绝:', event.reason);

      const errorDetails = {
        type: '未处理的错误',
        message: '发生了一个未处理的错误',
        details: `错误信息：${event.reason?.message || event.reason || '未知错误'}\n\n这可能是由于网络请求失败或服务器错误导致的。`,
        error: event.reason?.toString() || 'Unknown error',
      };
      setErrorInfo(errorDetails);
      message.error('发生了一个未处理的错误，请查看错误详情', 5);
    };

    const handleError = (event: ErrorEvent) => {
      event.preventDefault();
      console.error('全局错误:', event.error);

      const errorDetails = {
        type: 'JavaScript 错误',
        message: event.message || '发生了一个 JavaScript 错误',
        details: `错误信息：${event.message || '未知错误'}\n错误文件：${event.filename || '未知'}\n行号：${event.lineno || '未知'}`,
        error: event.error?.toString() || 'Unknown error',
      };
      setErrorInfo(errorDetails);
      message.error('发生了一个 JavaScript 错误，请查看错误详情', 5);
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  // 生成Markdown报告
  const generateMarkdownReport = useCallback((result: NonNullable<typeof analysisResult>) => {
    const lines = [];
    lines.push('# 依赖关系图\n');
    lines.push(`**入口文件：** \`${result.entryFile}\`\n`);
    
    // 如果是多入口文件分析，显示详细信息
    if (result.entryResults && result.entryResults.length > 1) {
      lines.push(`\n**已分析 ${result.entryResults.length} 个入口文件：**\n`);
      result.entryResults.forEach((entryResult, index) => {
        lines.push(`\n### 入口文件 ${index + 1}: \`${entryResult.entryFile}\`\n`);
        lines.push(`- 文件数: ${entryResult.statistics.totalFiles}`);
        lines.push(`- 依赖数: ${entryResult.statistics.totalDependencies}\n`);
      });
    }
    
    lines.push('\n## 汇总统计信息\n');
    lines.push(`- **总文件数**: ${result.statistics.totalFiles}`);
    lines.push(`- **总依赖数**: ${result.statistics.totalDependencies}\n`);
    lines.push('\n## 文件目录结构\n');
    lines.push('```');
    lines.push(result.directoryTree);
    lines.push('```\n');
    lines.push('\n## 依赖关系（汇总）\n');
    lines.push('```json');
    lines.push(JSON.stringify(result.dependencyGraph, null, 2));
    lines.push('```\n');
    return lines.join('\n');
  }, []);

  // 通过路径分析（支持单个或多个入口文件）
  const handleAnalyzeByPath = useCallback(
    async (e?: React.FormEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      // 优先使用多入口文件输入，如果没有则使用单入口文件
      const entriesText = entryFiles.trim() || entryFile.trim();
      if (!entriesText) {
        message.warning('请输入入口文件路径（支持多个，每行一个）');
        return;
      }

      setLoading(true);
      setInvalidEntries([]);
      setErrorInfo(null);

      try {
        const excludeDirsArray = excludeDirs
          .split(/[,\n]/)
          .map((dir: string) => dir.trim())
          .filter((dir: string) => dir.length > 0);

        // 解析入口文件列表（支持换行和逗号分隔）
        const entries = entriesText
          .split(/[,\n]/)
          .map((entry: string) => entry.trim())
          .filter((entry: string) => entry.length > 0);

        if (entries.length === 0) {
          message.warning('请输入至少一个入口文件路径');
          setLoading(false);
          return;
        }

        // 如果只有一个入口文件，使用单文件分析（保持向后兼容）
        if (entries.length === 1) {
          const result = await analyzeDependencies({
            entry: entries[0],
            projectRoot: projectRoot.trim() || undefined,
            maxDepth: 30,
            treeDepth: 10,
            showDeps: true,
            excludeDirs: excludeDirsArray,
          });

          if (result.success && 'data' in result && result.data) {
            setAnalysisResult(result.data as typeof analysisResult);
            setInvalidEntries([]);
            message.success('依赖分析完成！');
          } else {
            message.error('message' in result ? result.message || '分析失败' : '分析失败');
          }
        } else {
          // 多个入口文件，使用批量分析
          const result = await analyzeDependenciesBatch({
            entries,
            projectRoot: projectRoot.trim() || undefined,
            maxDepth: 30,
            treeDepth: 10,
            showDeps: true,
            excludeDirs: excludeDirsArray,
          });

          if (result.success && 'data' in result && result.data) {
            setAnalysisResult(result.data as typeof analysisResult);
            const invalid = result.invalidEntries || [];
            setInvalidEntries(invalid);

            if (invalid.length > 0) {
              message.warning(
                `分析完成！但有 ${invalid.length} 个入口文件不属于该项目或不存在`,
                5,
              );
            } else {
              message.success(`依赖分析完成！已分析 ${entries.length} 个入口文件`);
            }

            // 如果有分析错误，显示警告
            if (result.errors && result.errors.length > 0) {
              console.warn('部分入口文件分析失败:', result.errors);
            }
          } else {
            const invalid = result.invalidEntries || [];
            setInvalidEntries(invalid);
            const errorMsg =
              'message' in result ? result.message || '分析失败' : '分析失败';
            message.error(errorMsg, 5);

            if (invalid.length > 0) {
              setErrorInfo({
                type: '分析失败',
                message: errorMsg,
                details: `以下 ${invalid.length} 个入口文件不属于该项目或不存在：\n${invalid.join('\n')}`,
              });
            }
          }
        }
      } catch (error: any) {
        console.error('分析错误:', error);
        message.error(error.message || '分析过程中发生错误', 5);
        setErrorInfo({
          type: '分析错误',
          message: error.message || '分析过程中发生错误',
          details: error.toString(),
        });
      } finally {
        setLoading(false);
      }
    },
    [entryFile, entryFiles, projectRoot, excludeDirs],
  );

  // 选择项目目录
  const handleSelectProjectDirectory = useCallback(async () => {
    try {
      const result = await selectProjectDirectory();
      if (result.success && 'directoryPath' in result && result.directoryPath) {
        setProjectRoot(result.directoryPath);
        message.success('已选择项目目录');
      }
    } catch (error: any) {
      message.error(error.message || '选择目录失败');
    }
  }, []);


  // 通过选择 ZIP 文件分析（支持单个或多个入口文件）
  const handleAnalyzeByUpload = useCallback(async () => {
    setErrorInfo(null);
    setInvalidEntries([]);

    // 优先使用多入口文件输入，如果没有则使用单入口文件
    const entriesText = entryFiles.trim() || entryFile.trim();
    if (!entriesText) {
      message.warning('请输入入口文件路径（相对于项目根目录，支持多个，每行一个）');
      return;
    }

    setLoading(true);
    setAnalysisResult(null);

    try {
      const excludeDirsArray = excludeDirs
        .split(/[,\n]/)
        .map((dir: string) => dir.trim())
        .filter((dir: string) => dir.length > 0);

      // 解析入口文件列表（支持换行和逗号分隔）
      const entries = entriesText
        .split(/[,\n]/)
        .map((entry: string) => entry.trim())
        .filter((entry: string) => entry.length > 0);

      if (entries.length === 0) {
        message.warning('请输入至少一个入口文件路径');
        setLoading(false);
        return;
      }

      // 调用分析 API（支持单个或多个入口文件）
      const result = await selectAndAnalyzeZip({
        ...(entries.length === 1
          ? { entry: entries[0] }
          : { entries }),
        maxDepth: 30,
        treeDepth: 10,
        showDeps: true,
        excludeDirs: excludeDirsArray,
      });

      if (result.success && 'data' in result && result.data) {
        console.log('✅ 分析成功，准备设置结果');
        console.log('📊 结果数据:', result.data);

        setAnalysisResult(result.data as typeof analysisResult);
        setDirectoryTree(null);
        setUploadProjectRoot(null);
        setErrorInfo(null);
        const invalid = result.invalidEntries || [];
        setInvalidEntries(invalid);

        if (invalid.length > 0) {
          message.warning(
            `分析完成！但有 ${invalid.length} 个入口文件不属于该项目或不存在`,
            5,
          );
        } else {
          message.success(
            entries.length > 1
              ? `依赖分析完成！已分析 ${entries.length} 个入口文件`
              : '依赖分析完成！',
          );
        }

        // 如果有分析错误，显示警告
        if (result.errors && result.errors.length > 0) {
          console.warn('部分入口文件分析失败:', result.errors);
        }
      } else {
        if ('directoryTree' in result && result.directoryTree) {
          setDirectoryTree(result.directoryTree as typeof directoryTree);
          setUploadProjectRoot(
            'projectRoot' in result && result.projectRoot
              ? (result.projectRoot as string)
              : null,
          );
        } else {
          setDirectoryTree(null);
          setUploadProjectRoot(null);
        }

        const invalid = result.invalidEntries || [];
        setInvalidEntries(invalid);

        const errorDetails = {
          type: '分析失败',
          message: 'message' in result ? result.message || '分析失败' : '分析失败',
          details:
            'message' in result
              ? result.message || '服务器返回分析失败，但未提供详细原因'
              : '未知错误',
        };
        setErrorInfo(errorDetails);
        message.error(
          'message' in result ? result.message || '分析失败' : '分析失败',
          5,
        );
      }
    } catch (error: any) {
      console.error('分析错误:', error);
      const errorDetails = {
        type: '分析错误',
        message: error.message || '分析过程中发生错误',
        details: error.message || '未知错误',
      };
      setErrorInfo(errorDetails);
      message.error(error.message || '分析过程中发生错误', 5);
    } finally {
      setLoading(false);
    }
  }, [entryFile, entryFiles, excludeDirs]);

  // 下载报告
  const handleDownload = useCallback(() => {
    if (!analysisResult) {
      message.warning('请先进行分析');
      return;
    }

    const content = generateMarkdownReport(analysisResult);
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dependency-report-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success('报告下载成功');
  }, [analysisResult, generateMarkdownReport]);

  return (
    <div className="app-container">
      <Card title="依赖分析工具" className="header-card">
        <Tabs activeKey={mode} onChange={setMode} className="mode-tabs">
          <TabPane tab="路径分析" key="path">
            <div className="input-section">
              <div className="input-group">
                <label htmlFor="project-root-input" className="label">
                  项目根目录（可选）：
                </label>
                <Input
                  id="project-root-input"
                  value={projectRoot}
                  onChange={(e) => setProjectRoot(e.target.value)}
                  placeholder="例如: /path/to/project (留空则使用当前工作目录)"
                  disabled={loading}
                  suffix={
                    <Button
                      type="link"
                      icon={<FolderOpenOutlined />}
                      onClick={handleSelectProjectDirectory}
                      disabled={loading}
                    >
                      选择
                    </Button>
                  }
                />
              </div>
              <div className="input-group">
                <label htmlFor="entry-files-input" className="label">
                  入口文件路径（支持多个，每行一个或逗号分隔）：
                </label>
                <TextArea
                  id="entry-files-input"
                  value={entryFiles || entryFile}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEntryFiles(value);
                    // 如果只有一行，也更新单入口文件（保持兼容）
                    const lines = value.split(/[,\n]/).filter((l) => l.trim());
                    if (lines.length === 1) {
                      setEntryFile(lines[0].trim());
                    }
                  }}
                  placeholder="例如: src/pages/index.js&#10;或者多个文件（每行一个）:&#10;src/pages/index.js&#10;src/components/App.js&#10;src/utils/helper.js"
                  rows={4}
                  disabled={loading}
                />
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <Button
                    type="link"
                    icon={<FileSearchOutlined />}
                    onClick={async () => {
                      try {
                        const result = await selectEntryFile();
                        if (result.success && 'filePath' in result && result.filePath) {
                          const currentFiles = entryFiles || entryFile;
                          if (currentFiles.trim()) {
                            setEntryFiles(`${currentFiles}\n${result.filePath}`);
                          } else {
                            setEntryFiles(result.filePath);
                            setEntryFile(result.filePath);
                          }
                          message.success('已添加入口文件');
                        }
                      } catch (error: any) {
                        message.error(error.message || '选择文件失败');
                      }
                    }}
                    disabled={loading}
                    size="small"
                  >
                    添加文件
                  </Button>
                </div>
              </div>
              <div className="input-group">
                <label htmlFor="exclude-dirs-input" className="label">
                  排除目录（可选，用逗号或换行分隔）：
                </label>
                <TextArea
                  id="exclude-dirs-input"
                  value={excludeDirs}
                  onChange={(e) => setExcludeDirs(e.target.value)}
                  placeholder="例如: dist, build, node_modules&#10;或者: src/utils/test"
                  rows={3}
                  disabled={loading}
                />
              </div>
              <div className="button-group">
                <Button
                  type="primary"
                  htmlType="button"
                  icon={<FileSearchOutlined />}
                  onClick={handleAnalyzeByPath}
                  loading={loading}
                >
                  开始分析
                </Button>
                <Button
                  htmlType="button"
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    setEntryFile('');
                    setEntryFiles('');
                    setProjectRoot('');
                    setExcludeDirs('');
                    setAnalysisResult(null);
                    setDirectoryTree(null);
                    setUploadProjectRoot(null);
                    setErrorInfo(null);
                    setInvalidEntries([]);
                  }}
                  disabled={loading}
                >
                  重置
                </Button>
              </div>
            </div>
          </TabPane>
          <TabPane tab="ZIP 文件分析" key="upload">
            <div className="input-section">
              <div className="input-group">
                <label htmlFor="upload-entry-files-input" className="label">
                  入口文件路径（相对于项目根目录，支持多个，每行一个或逗号分隔）：
                </label>
                <TextArea
                  id="upload-entry-files-input"
                  value={entryFiles || entryFile}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEntryFiles(value);
                    // 如果只有一行，也更新单入口文件（保持兼容）
                    const lines = value.split(/[,\n]/).filter((l) => l.trim());
                    if (lines.length === 1) {
                      setEntryFile(lines[0].trim());
                    }
                  }}
                  placeholder="例如: src/index.js&#10;或者多个文件（每行一个）:&#10;src/index.js&#10;src/app.js&#10;src/components/App.js"
                  rows={4}
                  disabled={loading}
                />
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <Button
                    type="link"
                    icon={<FileSearchOutlined />}
                    onClick={async () => {
                      try {
                        const result = await selectEntryFile();
                        if (result.success && 'filePath' in result && result.filePath) {
                          const currentFiles = entryFiles || entryFile;
                          if (currentFiles.trim()) {
                            setEntryFiles(`${currentFiles}\n${result.filePath}`);
                          } else {
                            setEntryFiles(result.filePath);
                            setEntryFile(result.filePath);
                          }
                          message.success('已添加入口文件');
                        }
                      } catch (error: any) {
                        message.error(error.message || '选择文件失败');
                      }
                    }}
                    disabled={loading}
                    size="small"
                  >
                    添加文件
                  </Button>
                </div>
              </div>
              <div className="input-group">
                <label htmlFor="upload-exclude-dirs-input" className="label">
                  排除目录（可选，用逗号或换行分隔）：
                </label>
                <TextArea
                  id="upload-exclude-dirs-input"
                  value={excludeDirs}
                  onChange={(e) => setExcludeDirs(e.target.value)}
                  placeholder="例如: dist, build, node_modules&#10;或者: src/utils/test"
                  rows={3}
                  disabled={loading}
                />
              </div>
              <div className="button-group">
                <Button
                  type="primary"
                  htmlType="button"
                  icon={<FileSearchOutlined />}
                  onClick={handleAnalyzeByUpload}
                  loading={loading}
                >
                  选择 ZIP 文件并分析
                </Button>
                <Button
                  htmlType="button"
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    setEntryFile('');
                    setEntryFiles('');
                    setAnalysisResult(null);
                    setDirectoryTree(null);
                    setUploadProjectRoot(null);
                    setErrorInfo(null);
                    setInvalidEntries([]);
                  }}
                  disabled={loading}
                >
                  重置
                </Button>
              </div>
            </div>
          </TabPane>
        </Tabs>
      </Card>

      {/* 显示无效入口文件列表 */}
      {invalidEntries.length > 0 && (
        <Card className="error-card" style={{ marginBottom: 16 }}>
          <Alert
            message={`${invalidEntries.length} 个入口文件不属于该项目或不存在`}
            description={
              <div>
                <div style={{ marginBottom: 8, fontWeight: 'bold', color: '#ff4d4f' }}>
                  以下入口文件将被跳过：
                </div>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {invalidEntries.map((entry, index) => (
                    <li key={index} style={{ marginBottom: 4 }}>
                      <code style={{ fontSize: '12px' }}>{entry}</code>
                    </li>
                  ))}
                </ul>
                {projectRoot && (
                  <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                    项目根目录: <code>{projectRoot}</code>
                  </div>
                )}
              </div>
            }
            type="warning"
            showIcon
            closable
            onClose={() => setInvalidEntries([])}
            style={{ marginBottom: 0 }}
          />
        </Card>
      )}

      {/* 显示错误信息 */}
      {errorInfo && (
        <Card className="error-card" style={{ marginBottom: 16 }}>
          <Alert
            message={errorInfo.type || '错误'}
            description={
              <div>
                <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
                  {errorInfo.message}
                </div>
                {errorInfo.details && (
                  <div
                    style={{
                      whiteSpace: 'pre-wrap',
                      fontSize: '12px',
                      color: '#666',
                    }}
                  >
                    {errorInfo.details}
                  </div>
                )}
              </div>
            }
            type="error"
            showIcon
            closable
            onClose={() => setErrorInfo(null)}
            style={{ marginBottom: 0 }}
          />
        </Card>
      )}

      {/* 显示目录树（当找不到入口文件时） */}
      {directoryTree && !analysisResult && (
        <Card className="directory-tree-card" title="项目目录结构">
          <DirectoryTree
            directoryTree={directoryTree}
            projectRoot={uploadProjectRoot}
          />
        </Card>
      )}

      {analysisResult && (
        <>
          <Card className="stats-card">
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title="总文件数"
                  value={analysisResult.statistics.totalFiles}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="总依赖数"
                  value={analysisResult.statistics.totalDependencies}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="JavaScript 文件"
                  value={analysisResult.statistics.filesByType.js}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="TypeScript 文件"
                  value={
                    analysisResult.statistics.filesByType.ts +
                    analysisResult.statistics.filesByType.tsx
                  }
                />
              </Col>
            </Row>
            {analysisResult.entryResults && analysisResult.entryResults.length > 1 && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
                <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
                  已分析 {analysisResult.entryResults.length} 个入口文件：
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {analysisResult.entryResults.map((result, index) => (
                    <div key={index} style={{ marginBottom: 4 }}>
                      <code>{result.entryFile}</code>
                      {' - '}
                      {result.statistics.totalFiles} 个文件,
                      {result.statistics.totalDependencies} 个依赖
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card className="result-card">
            <div className="result-header">
              <h3>分析结果</h3>
              <Button icon={<DownloadOutlined />} onClick={handleDownload}>
                下载报告
              </Button>
            </div>
            <Tabs activeKey={activeTab} onChange={setActiveTab}>
              <TabPane tab="目录树结构" key="tree">
                <DirectoryTreeView
                  treeString={analysisResult.directoryTree}
                />
              </TabPane>
              <TabPane tab="依赖关系图" key="graph">
                <DependencyGraphView
                  dependencyGraph={analysisResult.dependencyGraph}
                />
              </TabPane>
              <TabPane tab="JSON 数据" key="json">
                <TextArea
                  value={JSON.stringify(analysisResult.dependencyGraph, null, 2)}
                  readOnly
                  autoSize={{ minRows: 10, maxRows: 30 }}
                  className="json-view"
                />
              </TabPane>
            </Tabs>
          </Card>
        </>
      )}

      {loading && (
        <div className="loading-overlay">
          <Spin size="large" tip="正在分析依赖关系，请稍候..." />
        </div>
      )}
    </div>
  );
};

export default App;

