/**
 * Electron 渲染进程入口 - React 应用
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './renderer/App';
import 'antd/dist/reset.css';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <ConfigProvider locale={zhCN}>
    <App />
  </ConfigProvider>
);

