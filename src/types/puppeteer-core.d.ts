declare module 'puppeteer-core' {
  const puppeteer: {
    launch: (opts?: any) => Promise<{
      newPage: () => Promise<{
        setContent: (html: string, opts?: any) => Promise<void>;
        pdf: (opts?: any) => Promise<Buffer>;
        close: () => Promise<void>;
      }>;
      close: () => Promise<void>;
    }>;
  };
  export default puppeteer;
  export = puppeteer;
}
