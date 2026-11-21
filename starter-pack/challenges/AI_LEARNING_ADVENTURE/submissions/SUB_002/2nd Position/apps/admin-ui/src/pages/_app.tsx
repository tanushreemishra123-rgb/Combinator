import type { AppProps } from 'next/app';
import { SWRConfig } from 'swr';

import '@/styles/main.scss';

export default function AdminApp({ Component, pageProps }: AppProps) {
  return (
    <SWRConfig>
      <Component {...pageProps} />
    </SWRConfig>
  );
}
