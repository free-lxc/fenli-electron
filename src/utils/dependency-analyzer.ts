/**
 * 依赖分析工具 - 核心功能模块
 * 从 server.js 提取的核心功能，用于 Electron IPC 调用
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

// 动态加载模块，使用绝对路径
function loadScriptsModule(modulePath: string) {
  // 尝试多种路径解析方式，找到第一个存在的路径
  // 1. 使用 app.getAppPath()（如果可用）
  // 2. 构建后：__dirname = .vite/build/utils -> ../../src/scripts
  // 3. 开发环境：__dirname = src/utils -> ../scripts
  // 4. 打包后（asar）：app.getAppPath() 返回 asar 路径，可以直接访问内部文件
  
  const possiblePaths: string[] = [];
  
  // 优先使用 app.getAppPath()（如果 app 已初始化）
  if (app && typeof app.getAppPath === 'function') {
    try {
      const appPath = app.getAppPath();
      // asar 环境下，appPath 可能是 asar 文件路径或解压后的路径
      possiblePaths.push(path.join(appPath, 'src', 'scripts'));
    } catch (e) {
      // app 未就绪时忽略
    }
  }
  
  // 添加基于 __dirname 的路径
  possiblePaths.push(
    path.resolve(__dirname, '../../src/scripts'), // 构建后路径
    path.resolve(__dirname, '../scripts'), // 开发环境路径
    path.resolve(process.cwd(), 'src/scripts'), // 基于工作目录
  );
  
  // 找到第一个存在的路径（检查 index.js 文件是否存在）
  const scriptsDir = possiblePaths.find(p => {
    try {
      const testPath = path.join(p, 'index.js');
      return fs.existsSync(testPath);
    } catch {
      return false;
    }
  }) || possiblePaths[0];
  
  const scriptsPath = path.join(scriptsDir, modulePath);
  return require(scriptsPath);
}

const AdmZip = require('adm-zip');

// 延迟加载，确保路径解析正确
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let analyzeDependencies: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let findFile: any;

function getAnalyzeDependencies() {
  if (!analyzeDependencies) {
    const module = loadScriptsModule('index');
    analyzeDependencies = module.analyzeDependencies;
  }
  return analyzeDependencies;
}

function getFindFile() {
  if (!findFile) {
    const module = loadScriptsModule('utils');
    findFile = module.findFile;
  }
  return findFile;
}

/**
 * 解压 ZIP 文件
 */
export function extractZip(zipPath: string, extractTo: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // 检查文件是否存在
      if (!fs.existsSync(zipPath)) {
        return reject(new Error(`ZIP 文件不存在: ${zipPath}`));
      }

      // 检查是否是文件
      const stat = fs.statSync(zipPath);
      if (!stat.isFile()) {
        return reject(new Error(`路径不是文件: ${zipPath}`));
      }

      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractTo, true);
      resolve(extractTo);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 检测 ZIP 解压后的实际项目根目录
 * ZIP 文件解压后可能直接是项目文件，也可能包含一个项目名称的目录
 */
export function detectProjectRoot(extractedDir: string): string {
  // 检查解压目录下的内容
  const items = fs.readdirSync(extractedDir);

  // 如果只有一个子目录，且该子目录看起来像项目根目录（包含 src、package.json 等）
  if (items.length === 1) {
    const subDir = path.join(extractedDir, items[0]);
    const stat = fs.statSync(subDir);

    if (stat.isDirectory()) {
      // 检查是否包含项目特征文件
      const hasSrc = fs.existsSync(path.join(subDir, 'src'));
      const hasPackageJson = fs.existsSync(path.join(subDir, 'package.json'));
      const hasIndex =
        fs.existsSync(path.join(subDir, 'index.js')) ||
        fs.existsSync(path.join(subDir, 'index.ts'));

      if (hasSrc || hasPackageJson || hasIndex) {
        return subDir;
      }
    }
  }

  // 检查解压目录本身是否就是项目根目录
  const hasSrc = fs.existsSync(path.join(extractedDir, 'src'));
  const hasPackageJson = fs.existsSync(path.join(extractedDir, 'package.json'));

  if (hasSrc || hasPackageJson) {
    return extractedDir;
  }

  // 如果只有一个子目录，即使没有明显特征，也尝试使用它
  if (items.length === 1) {
    const subDir = path.join(extractedDir, items[0]);
    const stat = fs.statSync(subDir);
    if (stat.isDirectory()) {
      return subDir;
    }
  }

  return extractedDir;
}

/**
 * 查找入口文件
 */
export function findEntryFile(projectRoot: string, entryHint?: string): string | null {
  // 首先尝试用户提供的路径
  if (entryHint) {
    // 移除开头的斜杠和点
    const normalizedHint = entryHint.replace(/^[/.]+/, '');
    const entryPath = path.join(projectRoot, normalizedHint);

    if (fs.existsSync(entryPath)) {
      return entryPath;
    }

    // 如果直接路径不存在，尝试查找文件（支持扩展名推断）
    const foundFile = getFindFile()(entryPath);
    if (foundFile) {
      return foundFile;
    }
  }

  // 尝试查找常见的入口文件
  const commonEntries = [
    'src/index.js',
    'src/index.jsx',
    'src/index.ts',
    'src/index.tsx',
    'index.js',
    'index.jsx',
    'index.ts',
    'index.tsx',
    'main.js',
    'app.js',
  ];

  for (const entry of commonEntries) {
    const entryPath = path.join(projectRoot, entry);
    if (fs.existsSync(entryPath)) {
      return entryPath;
    }
  }

  return null;
}

/**
 * 获取目录结构信息（只返回文件夹，用于前端展示）
 */
export interface DirectoryTreeNode {
  name: string;
  path: string;
  children: DirectoryTreeNode[];
}

export function getDirectoryTree(
  dir: string,
  maxDepth = 5,
  currentDepth = 0,
): DirectoryTreeNode | null {
  if (currentDepth >= maxDepth) {
    return null;
  }

  const tree: DirectoryTreeNode = {
    name: path.basename(dir),
    path: dir,
    children: [],
  };

  try {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      try {
        const stat = fs.statSync(fullPath);
        // 只处理目录，忽略文件
        if (stat.isDirectory()) {
          // 跳过 node_modules 等常见目录
          if (
            ['node_modules', '.git', '.svn', '.idea', 'dist', 'build'].includes(
              entry,
            )
          ) {
            continue;
          }

          const childTree = getDirectoryTree(fullPath, maxDepth, currentDepth + 1);
          if (childTree) {
            tree.children.push(childTree);
          }
        }
      } catch (error) {
        // 忽略权限错误等
        continue;
      }
    }

    // 按名称排序
    tree.children.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    // 忽略权限错误等
  }

  return tree;
}

/**
 * 获取目录结构信息（用于错误提示 - 文本格式）
 */
export function getDirectoryStructure(
  dir: string,
  maxDepth = 2,
  currentDepth = 0,
  prefix = '',
): string[] {
  if (currentDepth >= maxDepth) {
    return [];
  }

  const items: string[] = [];
  try {
    const entries = fs.readdirSync(dir);
    for (const entry of entries.slice(0, 10)) {
      // 只显示前10个
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      const isDir = stat.isDirectory();
      items.push(
        `${prefix}${isDir ? '📁' : '📄'} ${entry}${isDir ? '/' : ''}`,
      );

      if (isDir && currentDepth < maxDepth - 1) {
        items.push(
          ...getDirectoryStructure(fullPath, maxDepth, currentDepth + 1, prefix + '  '),
        );
      }
    }
  } catch (error) {
    // 忽略权限错误等
  }

  return items;
}

/**
 * 验证文件路径是否属于项目根目录
 */
export function isFileInProject(filePath: string, projectRoot: string): boolean {
  try {
    const normalizedFilePath = path.resolve(filePath);
    const normalizedProjectRoot = path.resolve(projectRoot);
    
    // 检查文件路径是否以项目根目录开头
    return normalizedFilePath.startsWith(normalizedProjectRoot + path.sep) ||
           normalizedFilePath === normalizedProjectRoot;
  } catch (error) {
    console.error('路径验证错误:', error);
    return false;
  }
}

/**
 * 验证并过滤入口文件列表
 */
export interface ValidateEntriesResult {
  validEntries: string[];
  invalidEntries: string[];
}

export function validateEntryFiles(
  entries: string[],
  projectRoot?: string,
): ValidateEntriesResult {
  const validEntries: string[] = [];
  const invalidEntries: string[] = [];

  if (!projectRoot) {
    // 如果没有项目根目录，所有文件都视为有效
    return {
      validEntries: entries.filter((e) => e.trim().length > 0),
      invalidEntries: [],
    };
  }

  const normalizedProjectRoot = path.resolve(projectRoot);

  for (const entry of entries) {
    const trimmedEntry = entry.trim();
    if (!trimmedEntry) {
      continue;
    }

    // 尝试解析为绝对路径或相对于项目根目录的路径
    let entryPath: string;
    if (path.isAbsolute(trimmedEntry)) {
      entryPath = trimmedEntry;
    } else {
      entryPath = path.join(normalizedProjectRoot, trimmedEntry);
    }

    // 检查文件是否存在
    if (!fs.existsSync(entryPath)) {
      invalidEntries.push(trimmedEntry);
      continue;
    }

    // 检查文件是否在项目根目录下
    if (isFileInProject(entryPath, normalizedProjectRoot)) {
      validEntries.push(entryPath);
    } else {
      invalidEntries.push(trimmedEntry);
    }
  }

  return { validEntries, invalidEntries };
}

/**
 * 合并多个分析结果
 */
export interface MergedAnalysisResult {
  entryFile: string; // 多个入口文件用逗号分隔
  statistics: {
    totalFiles: number;
    totalDependencies: number;
    filesByType: { js: number; ts: number; tsx: number };
  };
  directoryTree: string;
  dependencyGraph: Record<string, string[]>;
  entryResults: Array<{
    entryFile: string;
    statistics: {
      totalFiles: number;
      totalDependencies: number;
      filesByType: { js: number; ts: number; tsx: number };
    };
    dependencyGraph: Record<string, string[]>;
  }>;
}

export function mergeAnalysisResults(
  results: Array<{
    entryFile: string;
    statistics: {
      totalFiles: number;
      totalDependencies: number;
      filesByType: { js: number; ts: number; tsx: number };
    };
    directoryTree: string;
    dependencyGraph: Record<string, string[]>;
  }>,
): MergedAnalysisResult {
  if (results.length === 0) {
    throw new Error('没有可合并的分析结果');
  }

  // 合并统计信息
  const mergedStats = {
    totalFiles: 0,
    totalDependencies: 0,
    filesByType: { js: 0, ts: 0, tsx: 0 },
  };

  // 合并依赖图（去重）
  const mergedDependencyGraph: Record<string, string[]> = {};
  const allFiles = new Set<string>();

  for (const result of results) {
    // 累加统计信息
    mergedStats.totalFiles += result.statistics.totalFiles;
    mergedStats.totalDependencies += result.statistics.totalDependencies;
    mergedStats.filesByType.js += result.statistics.filesByType.js;
    mergedStats.filesByType.ts += result.statistics.filesByType.ts;
    mergedStats.filesByType.tsx += result.statistics.filesByType.tsx;

    // 合并依赖图
    for (const [file, deps] of Object.entries(result.dependencyGraph)) {
      allFiles.add(file);
      if (!mergedDependencyGraph[file]) {
        mergedDependencyGraph[file] = [];
      }
      // 合并依赖列表并去重
      const existingDeps = new Set(mergedDependencyGraph[file]);
      for (const dep of deps) {
        if (!existingDeps.has(dep)) {
          mergedDependencyGraph[file].push(dep);
          existingDeps.add(dep);
        }
      }
    }
  }

  // 使用第一个结果的目录树（通常所有入口文件在同一项目下，目录树相同）
  const directoryTree = results[0]?.directoryTree || '';

  // 构建入口文件列表
  const entryFiles = results.map((r) => r.entryFile).join(', ');

  return {
    entryFile: entryFiles,
    statistics: mergedStats,
    directoryTree,
    dependencyGraph: mergedDependencyGraph,
    entryResults: results.map((r) => ({
      entryFile: r.entryFile,
      statistics: r.statistics,
      dependencyGraph: r.dependencyGraph,
    })),
  };
}

/**
 * 分析依赖（通过文件路径）
 */
export interface AnalyzeParams {
  entry: string;
  projectRoot?: string;
  maxDepth?: number;
  treeDepth?: number;
  showDeps?: boolean;
  excludeDirs?: string[];
}

export async function analyzeByPath(params: AnalyzeParams) {
  const {
    entry,
    projectRoot = process.cwd(),
    maxDepth = 30,
    treeDepth = 10,
    showDeps = true,
    excludeDirs = [],
  } = params;

  if (!entry) {
    throw new Error('缺少入口文件路径');
  }

  console.log(`开始分析: ${entry}, 项目根目录: ${projectRoot}`);
  const result = getAnalyzeDependencies()({
    entryFile: entry,
    projectRoot,
    maxDepth,
    treeDepth,
    showDeps,
    excludeDirs: Array.isArray(excludeDirs) ? excludeDirs : excludeDirs ? [excludeDirs] : [],
  });

  console.log(`分析完成: 共 ${result.statistics.totalFiles} 个文件`);

  return {
    success: true,
    data: result,
  };
}

/**
 * 批量分析多个入口文件
 */
export interface BatchAnalyzeParams {
  entries: string[];
  projectRoot?: string;
  maxDepth?: number;
  treeDepth?: number;
  showDeps?: boolean;
  excludeDirs?: string[];
}

export async function analyzeByPathBatch(params: BatchAnalyzeParams) {
  const {
    entries,
    projectRoot = process.cwd(),
    maxDepth = 30,
    treeDepth = 10,
    showDeps = true,
    excludeDirs = [],
  } = params;

  if (!entries || entries.length === 0) {
    throw new Error('缺少入口文件路径列表');
  }

  // 验证入口文件
  const { validEntries, invalidEntries } = validateEntryFiles(entries, projectRoot);

  if (validEntries.length === 0) {
    return {
      success: false,
      message: '没有有效的入口文件',
      invalidEntries,
    };
  }

  // 批量分析有效的入口文件
  const analysisResults = [];
  const errors: Array<{ entry: string; error: string }> = [];

  for (const entry of validEntries) {
    try {
      console.log(`开始分析: ${entry}, 项目根目录: ${projectRoot}`);
      const result = getAnalyzeDependencies()({
        entryFile: entry,
        projectRoot,
        maxDepth,
        treeDepth,
        showDeps,
        excludeDirs: Array.isArray(excludeDirs) ? excludeDirs : excludeDirs ? [excludeDirs] : [],
      });
      console.log(`分析完成: ${entry}, 共 ${result.statistics.totalFiles} 个文件`);
      analysisResults.push(result);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error(`分析 ${entry} 时出错:`, errorMessage);
      errors.push({ entry, error: errorMessage });
    }
  }

  if (analysisResults.length === 0) {
    return {
      success: false,
      message: '所有入口文件分析失败',
      invalidEntries,
      errors,
    };
  }

  // 合并分析结果
  const mergedResult = mergeAnalysisResults(analysisResults);

  return {
    success: true,
    data: mergedResult,
    invalidEntries,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * 上传并分析项目文件
 */
export interface UploadAnalyzeParams {
  zipFilePath: string;
  entry?: string; // 单个入口文件（向后兼容）
  entries?: string[]; // 多个入口文件
  uploadsDir: string;
  maxDepth?: number;
  treeDepth?: number;
  showDeps?: boolean;
  excludeDirs?: string[];
}

export async function analyzeByUpload(params: UploadAnalyzeParams) {
  const {
    zipFilePath,
    entry,
    entries,
    uploadsDir,
    maxDepth = 30,
    treeDepth = 10,
    showDeps = true,
    excludeDirs = [],
  } = params;

  // 验证文件是否存在
  if (!fs.existsSync(zipFilePath)) {
    throw new Error(`上传的文件不存在: ${zipFilePath}。可能是文件上传失败。`);
  }

  // 判断文件类型
  const fileExt = path.extname(zipFilePath).toLowerCase();

  if (fileExt !== '.zip') {
    throw new Error('目前只支持 ZIP 格式的项目压缩包');
  }

  // 解压 ZIP 文件
  const extractedDir = path.join(uploadsDir, `extracted-${Date.now()}`);
  await extractZip(zipFilePath, extractedDir);

  // 检测实际的项目根目录（ZIP 可能包含一个项目名称的目录）
  const projectRoot = detectProjectRoot(extractedDir);

  // 确定要分析的入口文件列表
  let entryList: string[] = [];
  if (entries && entries.length > 0) {
    entryList = entries;
  } else if (entry) {
    entryList = [entry];
  } else {
    throw new Error('请提供入口文件路径（相对于项目根目录）');
  }

  // 验证并查找入口文件
  const { validEntries, invalidEntries } = validateEntryFiles(entryList, projectRoot);

  if (validEntries.length === 0) {
    // 获取目录树结构（只包含文件夹）
    const directoryTree = getDirectoryTree(projectRoot, 5);

    // 获取目录结构用于错误提示（文本格式）
    const dirStructure = getDirectoryStructure(projectRoot, 2);
    const structureInfo =
      dirStructure.length > 0
        ? `\n\n解压后的目录结构：\n${dirStructure.slice(0, 20).join('\n')}${
            dirStructure.length > 20 ? '\n...' : ''
          }`
        : '';

    const invalidList = invalidEntries.length > 0 ? `\n无效的入口文件：\n${invalidEntries.join('\n')}` : '';
    return {
      success: false,
      message: `无法找到有效的入口文件。\n项目根目录: ${projectRoot}${invalidList}${structureInfo}`,
      directoryTree,
      projectRoot,
      invalidEntries,
    };
  }

  // 如果只有一个入口文件，使用单文件分析（保持向后兼容）
  if (validEntries.length === 1) {
    const entryPath = validEntries[0];
    console.log(`开始分析上传文件: ${entryPath}, 项目根目录: ${projectRoot}`);
    // 分析依赖
    const result = getAnalyzeDependencies()({
      entryFile: entryPath,
      projectRoot,
      maxDepth: parseInt(String(maxDepth), 10),
      treeDepth: parseInt(String(treeDepth), 10),
      showDeps: showDeps !== false,
      excludeDirs: Array.isArray(excludeDirs) ? excludeDirs : excludeDirs ? [excludeDirs] : [],
    });

    console.log(`分析完成: 共 ${result.statistics.totalFiles} 个文件`);

    return {
      success: true,
      data: result,
      ok: true,
      invalidEntries: invalidEntries.length > 0 ? invalidEntries : undefined,
    };
  }

  // 多个入口文件，使用批量分析
  const analysisResults = [];
  const errors: Array<{ entry: string; error: string }> = [];

  for (const entryPath of validEntries) {
    try {
      console.log(`开始分析上传文件: ${entryPath}, 项目根目录: ${projectRoot}`);
      const result = getAnalyzeDependencies()({
        entryFile: entryPath,
        projectRoot,
        maxDepth: parseInt(String(maxDepth), 10),
        treeDepth: parseInt(String(treeDepth), 10),
        showDeps: showDeps !== false,
        excludeDirs: Array.isArray(excludeDirs) ? excludeDirs : excludeDirs ? [excludeDirs] : [],
      });
      console.log(`分析完成: ${entryPath}, 共 ${result.statistics.totalFiles} 个文件`);
      analysisResults.push(result);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error(`分析 ${entryPath} 时出错:`, errorMessage);
      errors.push({ entry: entryPath, error: errorMessage });
    }
  }

  if (analysisResults.length === 0) {
    return {
      success: false,
      message: '所有入口文件分析失败',
      invalidEntries,
      errors,
      directoryTree: getDirectoryTree(projectRoot, 5),
      projectRoot,
    };
  }

  // 合并分析结果
  const mergedResult = mergeAnalysisResults(analysisResults);

  return {
    success: true,
    data: mergedResult,
    ok: true,
    invalidEntries: invalidEntries.length > 0 ? invalidEntries : undefined,
    errors: errors.length > 0 ? errors : undefined,
  };
}

