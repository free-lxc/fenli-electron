/**
 * Electron IPC 处理器
 * 处理来自渲染进程的依赖分析请求
 */

import { ipcMain, dialog, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import {
  analyzeByPath,
  analyzeByPathBatch,
  analyzeByUpload,
  getDirectoryTree,
  AnalyzeParams,
  BatchAnalyzeParams,
  UploadAnalyzeParams,
} from './utils/dependency-analyzer';

/**
 * 获取上传目录路径（使用 Electron 的用户数据目录）
 */
function getUploadsDir(): string {
  const userDataPath = app.getPath('userData');
  const uploadsDir = path.join(userDataPath, 'uploads');
  
  // 确保目录存在
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  return uploadsDir;
}

/**
 * 注册所有 IPC 处理器
 */
export function registerIpcHandlers() {
  /**
   * IPC: 分析依赖（通过文件路径）
   */
  ipcMain.handle('analyze-dependencies', async (_event, params: AnalyzeParams) => {
    try {
      const result = await analyzeByPath(params);
      return result;
    } catch (error: unknown) {
      console.error('分析错误:', error);
      const errorMessage = error instanceof Error ? error.message : '分析过程中发生错误';
      return {
        success: false,
        message: errorMessage,
      };
    }
  });

  /**
   * IPC: 批量分析依赖（通过文件路径）
   */
  ipcMain.handle('analyze-dependencies-batch', async (_event, params: BatchAnalyzeParams) => {
    try {
      const result = await analyzeByPathBatch(params);
      return result;
    } catch (error: unknown) {
      console.error('批量分析错误:', error);
      const errorMessage = error instanceof Error ? error.message : '批量分析过程中发生错误';
      return {
        success: false,
        message: errorMessage,
        invalidEntries: [],
      };
    }
  });

  /**
   * IPC: 选择 ZIP 文件并分析
   */
  ipcMain.handle('select-and-analyze-zip', async (event, params: Omit<UploadAnalyzeParams, 'zipFilePath' | 'uploadsDir'>) => {
    try {
      // 使用 Electron dialog 选择文件
      const result = await dialog.showOpenDialog({
        title: '选择项目 ZIP 文件',
        filters: [
          { name: 'ZIP 文件', extensions: ['zip'] },
          { name: '所有文件', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return {
          success: false,
          message: '未选择文件',
        };
      }

      const zipFilePath = result.filePaths[0];
      const uploadsDir = getUploadsDir();

      // 支持单个或多个入口文件
      const analyzeParams: UploadAnalyzeParams = {
        ...params,
        zipFilePath,
        uploadsDir,
      };

      const analyzeResult = await analyzeByUpload(analyzeParams);
      return analyzeResult;
    } catch (error: unknown) {
      console.error('上传分析错误:', error);
      const errorMessage = error instanceof Error ? error.message : '分析过程中发生错误';
      return {
        success: false,
        message: errorMessage,
      };
    }
  });

  /**
   * IPC: 分析已选择的 ZIP 文件
   */
  ipcMain.handle('analyze-zip-file', async (_event, params: UploadAnalyzeParams) => {
    try {
      const uploadsDir = getUploadsDir();
      const analyzeParams: UploadAnalyzeParams = {
        ...params,
        uploadsDir,
      };
      const result = await analyzeByUpload(analyzeParams);
      return result;
    } catch (error: unknown) {
      console.error('上传分析错误:', error);
      const errorMessage = error instanceof Error ? error.message : '分析过程中发生错误';
      return {
        success: false,
        message: errorMessage,
      };
    }
  });

  /**
   * IPC: 选择项目目录
   */
  ipcMain.handle('select-project-directory', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: '选择项目根目录',
        properties: ['openDirectory'],
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return {
          success: false,
          message: '未选择目录',
        };
      }

      return {
        success: true,
        directoryPath: result.filePaths[0],
      };
    } catch (error: unknown) {
      console.error('选择目录错误:', error);
      const errorMessage = error instanceof Error ? error.message : '选择目录时发生错误';
      return {
        success: false,
        message: errorMessage,
      };
    }
  });

  /**
   * IPC: 选择入口文件
   */
  ipcMain.handle('select-entry-file', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: '选择入口文件',
        filters: [
          { name: 'JavaScript/TypeScript', extensions: ['js', 'jsx', 'ts', 'tsx'] },
          { name: '所有文件', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return {
          success: false,
          message: '未选择文件',
        };
      }

      return {
        success: true,
        filePath: result.filePaths[0],
      };
    } catch (error: unknown) {
      console.error('选择文件错误:', error);
      const errorMessage = error instanceof Error ? error.message : '选择文件时发生错误';
      return {
        success: false,
        message: errorMessage,
      };
    }
  });

  /**
   * IPC: 获取目录树结构
   */
  ipcMain.handle('get-directory-tree', async (_event, dirPath: string, maxDepth = 5) => {
    try {
      const tree = getDirectoryTree(dirPath, maxDepth);
      return {
        success: true,
        data: tree,
      };
    } catch (error: unknown) {
      console.error('获取目录树错误:', error);
      const errorMessage = error instanceof Error ? error.message : '获取目录树时发生错误';
      return {
        success: false,
        message: errorMessage,
      };
    }
  });

  console.log('IPC 处理器已注册');
}

