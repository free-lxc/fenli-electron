/**
 * 依赖分析服务 - 使用 Electron IPC
 */

/**
 * 分析依赖（通过文件路径）
 */
export const analyzeDependencies = async (params: {
  entry: string;
  projectRoot?: string;
  maxDepth?: number;
  treeDepth?: number;
  showDeps?: boolean;
  excludeDirs?: string[];
}) => {
  try {
    if (typeof window !== 'undefined' && window.electronAPI) {
      return await window.electronAPI.analyzeDependencies(params);
    } else {
      throw new Error('Electron API 不可用');
    }
  } catch (error: unknown) {
    console.error('依赖分析API调用失败:', error);
    const errorMessage = error instanceof Error ? error.message : '分析过程中发生错误';
    return {
      success: false,
      message: errorMessage,
      error,
    };
  }
};

/**
 * 选择 ZIP 文件并分析
 */
export const selectAndAnalyzeZip = async (params: {
  entry?: string; // 单个入口文件（向后兼容）
  entries?: string[]; // 多个入口文件
  maxDepth?: number;
  treeDepth?: number;
  showDeps?: boolean;
  excludeDirs?: string[];
}) => {
  try {
    if (typeof window !== 'undefined' && window.electronAPI) {
      return await window.electronAPI.selectAndAnalyzeZip(params);
    } else {
      throw new Error('Electron API 不可用');
    }
  } catch (error: unknown) {
    console.error('选择并分析 ZIP 文件失败:', error);
    const errorMessage = error instanceof Error ? error.message : '选择并分析文件时发生错误';
    return {
      success: false,
      message: errorMessage,
      error,
      invalidEntries: [] as string[],
    };
  }
};

/**
 * 选择项目目录
 */
export const selectProjectDirectory = async () => {
  try {
    if (typeof window !== 'undefined' && window.electronAPI) {
      return await window.electronAPI.selectProjectDirectory();
    } else {
      throw new Error('Electron API 不可用');
    }
  } catch (error: unknown) {
    console.error('选择项目目录失败:', error);
    const errorMessage = error instanceof Error ? error.message : '选择目录时发生错误';
    return {
      success: false,
      message: errorMessage,
      error,
    };
  }
};

/**
 * 选择入口文件
 */
export const selectEntryFile = async () => {
  try {
    if (typeof window !== 'undefined' && window.electronAPI) {
      return await window.electronAPI.selectEntryFile();
    } else {
      throw new Error('Electron API 不可用');
    }
  } catch (error: unknown) {
    console.error('选择入口文件失败:', error);
    const errorMessage = error instanceof Error ? error.message : '选择文件时发生错误';
    return {
      success: false,
      message: errorMessage,
      error,
    };
  }
};

/**
 * 批量分析依赖（通过文件路径）
 */
export const analyzeDependenciesBatch = async (params: {
  entries: string[];
  projectRoot?: string;
  maxDepth?: number;
  treeDepth?: number;
  showDeps?: boolean;
  excludeDirs?: string[];
}) => {
  try {
    if (typeof window !== 'undefined' && window.electronAPI) {
      return await window.electronAPI.analyzeDependenciesBatch(params);
    } else {
      throw new Error('Electron API 不可用');
    }
  } catch (error: unknown) {
    console.error('批量依赖分析API调用失败:', error);
    const errorMessage = error instanceof Error ? error.message : '批量分析过程中发生错误';
    return {
      success: false,
      message: errorMessage,
      error,
      invalidEntries: [] as string[],
    };
  }
};

export default analyzeDependencies;

