declare module 'dom-to-image-more' {
  type Style = Record<string, string | number>;
  type Filter = (node: Node) => boolean;

  export type Options = {
    bgcolor?: string;
    width?: number;
    height?: number;
    style?: Style;
    cacheBust?: boolean;
    filter?: Filter;
    quality?: number;
  };

  const domToImage: {
    toPng(node: HTMLElement, options?: Options): Promise<string>;
    toJpeg(node: HTMLElement, options?: Options): Promise<string>;
    toBlob(node: HTMLElement, options?: Options): Promise<Blob>;
  };

  export default domToImage;
}

