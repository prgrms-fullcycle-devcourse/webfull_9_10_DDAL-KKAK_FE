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
    /** dom-to-image-more 내부 클론 직후 호출 (라이브러리 타입에 없어 런타임에서만 지원됨) */
    onclone?: (clonedRoot: HTMLElement) => void;
  };

  const domToImage: {
    toPng(node: HTMLElement, options?: Options): Promise<string>;
    toJpeg(node: HTMLElement, options?: Options): Promise<string>;
    toBlob(node: HTMLElement, options?: Options): Promise<Blob>;
  };

  export default domToImage;
}

