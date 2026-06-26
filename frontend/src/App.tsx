import 'antd/dist/reset.css';
import React from 'react';
import { ConfigProvider } from 'antd';
import { neuralineTheme } from './styles/theme';
import AppRouter from './routes';

const App: React.FC = () => {
  return (
    <ConfigProvider theme={neuralineTheme}>
      <AppRouter />
    </ConfigProvider>
  );
};

export default App;
