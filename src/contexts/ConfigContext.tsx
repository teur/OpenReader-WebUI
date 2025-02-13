'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getItem, indexedDBService, setItem } from '@/utils/indexedDB';

export type ViewType = 'single' | 'dual' | 'scroll';
interface ConfigContextType {
  apiKey: string;
  baseUrl: string;
  viewType: ViewType;
  voiceSpeed: number;
  voice: string;
  skipBlank: boolean;
  updateConfig: (newConfig: Partial<{ apiKey: string; baseUrl: string; viewType: ViewType }>) => Promise<void>;
  updateConfigKey: <K extends keyof ConfigValues>(key: K, value: ConfigValues[K]) => Promise<void>;
  isLoading: boolean;
  isDBReady: boolean;
}

// Add this type to help with type safety
type ConfigValues = {
  apiKey: string;
  baseUrl: string;
  viewType: ViewType;
  voiceSpeed: number;
  voice: string;
  skipBlank: boolean;
};

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
  // Config state
  const [apiKey, setApiKey] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [viewType, setViewType] = useState<ViewType>('single');
  const [voiceSpeed, setVoiceSpeed] = useState<number>(1);
  const [voice, setVoice] = useState<string>('af_sarah');
  const [skipBlank, setSkipBlank] = useState<boolean>(true);

  const [isLoading, setIsLoading] = useState(true);
  const [isDBReady, setIsDBReady] = useState(false);

  useEffect(() => {
    const initializeDB = async () => {
      try {
        setIsLoading(true);
        await indexedDBService.init();
        setIsDBReady(true);
        
        // Now load config
        const cachedApiKey = await getItem('apiKey');
        const cachedBaseUrl = await getItem('baseUrl');
        const cachedViewType = await getItem('viewType');
        const cachedVoiceSpeed = await getItem('voiceSpeed');
        const cachedVoice = await getItem('voice');
        const cachedSkipBlank = await getItem('skipBlank');

        if (cachedApiKey) console.log('Cached API key found:', cachedApiKey);
        if (cachedBaseUrl) console.log('Cached base URL found:', cachedBaseUrl);
        if (cachedViewType) console.log('Cached view type found:', cachedViewType);
        if (cachedVoiceSpeed) console.log('Cached voice speed found:', cachedVoiceSpeed);
        if (cachedVoice) console.log('Cached voice found:', cachedVoice);
        if (cachedSkipBlank) console.log('Cached skip blank found:', cachedSkipBlank);

        // If not in cache, use env variables
        const defaultApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '1234567890';
        const defaultBaseUrl = process.env.NEXT_PUBLIC_OPENAI_API_BASE || 'https://api.openai.com/v1';

        // Set the values
        setApiKey(cachedApiKey || defaultApiKey);
        setBaseUrl(cachedBaseUrl || defaultBaseUrl);
        setViewType((cachedViewType || 'single') as ViewType);
        setVoiceSpeed(parseFloat(cachedVoiceSpeed || '1'));
        setVoice(cachedVoice || 'af_sarah');
        setSkipBlank(cachedSkipBlank === 'false' ? false : true);

        // If not in cache, save to cache
        if (!cachedApiKey) {
          await setItem('apiKey', defaultApiKey);
        }
        if (!cachedBaseUrl) {
          await setItem('baseUrl', defaultBaseUrl);
        }
        if (!cachedViewType) {
          await setItem('viewType', 'single');
        }
        if (cachedSkipBlank === null) {
          await setItem('skipBlank', 'true');
        }
        
      } catch (error) {
        console.error('Error initializing:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeDB();
  }, []);

  const updateConfig = async (newConfig: Partial<{ apiKey: string; baseUrl: string }>) => {
    try {
      if (newConfig.apiKey !== undefined) {
        await setItem('apiKey', newConfig.apiKey);
        setApiKey(newConfig.apiKey);
      }
      if (newConfig.baseUrl !== undefined) {
        await setItem('baseUrl', newConfig.baseUrl);
        setBaseUrl(newConfig.baseUrl);
      }
    } catch (error) {
      console.error('Error updating config:', error);
      throw error;
    }
  };

  const updateConfigKey = async <K extends keyof ConfigValues>(key: K, value: ConfigValues[K]) => {
    try {
      await setItem(key, value.toString());
      switch (key) {
        case 'apiKey':
          setApiKey(value as string);
          break;
        case 'baseUrl':
          setBaseUrl(value as string);
          break;
        case 'viewType':
          setViewType(value as ViewType);
          break;
        case 'voiceSpeed':
          setVoiceSpeed(value as number);
          break;
        case 'voice':
          setVoice(value as string);
          break;
        case 'skipBlank':
          setSkipBlank(value as boolean);
          break;
      }
    } catch (error) {
      console.error(`Error updating config key ${key}:`, error);
      throw error;
    }
  };

  return (
    <ConfigContext.Provider value={{ 
      apiKey, 
      baseUrl, 
      viewType, 
      voiceSpeed,
      voice,
      skipBlank,
      updateConfig, 
      updateConfigKey,
      isLoading, 
      isDBReady 
    }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}