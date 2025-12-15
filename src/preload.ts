/**
 * Preload 脚本
 * 在渲染进程中暴露安全的 API，用于与主进程通信
 */

import { contextBridge, ipcRenderer } from 'electron';

// 暴露受保护的方法给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 分析依赖（通过文件路径）
  analyzeDependencies: (params: {
    entry: string;
    projectRoot?: string;
    maxDepth?: number;
    treeDepth?: number;
    showDeps?: boolean;
    excludeDirs?: string[];
  }) => ipcRenderer.invoke('analyze-dependencies', params),

  // 批量分析依赖（通过文件路径）
  analyzeDependenciesBatch: (params: {
    entries: string[];
    projectRoot?: string;
    maxDepth?: number;
    treeDepth?: number;
    showDeps?: boolean;
    excludeDirs?: string[];
  }) => ipcRenderer.invoke('analyze-dependencies-batch', params),

  // 选择 ZIP 文件并分析
  selectAndAnalyzeZip: (params: {
    entry?: string; // 单个入口文件（向后兼容）
    entries?: string[]; // 多个入口文件
    maxDepth?: number;
    treeDepth?: number;
    showDeps?: boolean;
    excludeDirs?: string[];
  }) => ipcRenderer.invoke('select-and-analyze-zip', params),

  // 分析已选择的 ZIP 文件
  analyzeZipFile: (params: {
    zipFilePath: string;
    entry?: string; // 单个入口文件（向后兼容）
    entries?: string[]; // 多个入口文件
    maxDepth?: number;
    treeDepth?: number;
    showDeps?: boolean;
    excludeDirs?: string[];
  }) => ipcRenderer.invoke('analyze-zip-file', params),

  // 选择项目目录
  selectProjectDirectory: () => ipcRenderer.invoke('select-project-directory'),

  // 选择入口文件
  selectEntryFile: () => ipcRenderer.invoke('select-entry-file'),

  // 获取目录树结构
  getDirectoryTree: (dirPath: string, maxDepth?: number) =>
    ipcRenderer.invoke('get-directory-tree', dirPath, maxDepth),
});

// 类型声明（用于 TypeScript）
declare global {
  interface Window {
    electronAPI: {
      analyzeDependencies: (params: {
        entry: string;
        projectRoot?: string;
        maxDepth?: number;
        treeDepth?: number;
        showDeps?: boolean;
        excludeDirs?: string[];
      }) => Promise<{ success: boolean; data?: unknown; message?: string }>;
      analyzeDependenciesBatch: (params: {
        entries: string[];
        projectRoot?: string;
        maxDepth?: number;
        treeDepth?: number;
        showDeps?: boolean;
        excludeDirs?: string[];
      }) => Promise<{
        success: boolean;
        data?: unknown;
        message?: string;
        invalidEntries?: string[];
        errors?: Array<{ entry: string; error: string }>;
      }>;
      selectAndAnalyzeZip: (params: {
        entry?: string; // 单个入口文件（向后兼容）
        entries?: string[]; // 多个入口文件
        maxDepth?: number;
        treeDepth?: number;
        showDeps?: boolean;
        excludeDirs?: string[];
      }) => Promise<{
        success: boolean;
        data?: unknown;
        message?: string;
        invalidEntries?: string[];
        errors?: Array<{ entry: string; error: string }>;
      }>;
      analyzeZipFile: (params: {
        zipFilePath: string;
        entry?: string; // 单个入口文件（向后兼容）
        entries?: string[]; // 多个入口文件
        maxDepth?: number;
        treeDepth?: number;
        showDeps?: boolean;
        excludeDirs?: string[];
      }) => Promise<{
        success: boolean;
        data?: unknown;
        message?: string;
        invalidEntries?: string[];
        errors?: Array<{ entry: string; error: string }>;
      }>;
      selectProjectDirectory: () => Promise<{ success: boolean; directoryPath?: string; message?: string }>;
      selectEntryFile: () => Promise<{ success: boolean; filePath?: string; message?: string }>;
      getDirectoryTree: (dirPath: string, maxDepth?: number) => Promise<{ success: boolean; data?: unknown; message?: string }>;
    };
  }
}
