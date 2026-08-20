import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider } from 'react-native-paper';
import { AppNavigator } from './src/navigation/AppNavigator';
import { paperTheme } from './src/theme';

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import '@/global.css';

const queryClient = new QueryClient();

const App: React.FC = () => {
  return (
    <GluestackUIProvider mode="light">
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={paperTheme}>
          <AppNavigator />
        </PaperProvider>
      </QueryClientProvider>
    </GluestackUIProvider>
  );
};

export default App;
