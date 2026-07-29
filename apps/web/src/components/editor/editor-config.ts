import { apiUrl } from '@/lib/api';

export type EditorConfigLike = ReturnType<typeof buildEditorConfig>;

export function buildEditorConfig(opts: { token: string; fields: string[] }) {
  return {
    apis: {
      url: `${apiUrl}/api/editor`,
      userToken: opts.token,
      searchFonts: '/search-fonts',
      searchTemplates: '/search-templates',
      searchTexts: '/search-texts',
      searchImages: '/search-images',
      searchShapes: '/search-shapes',
      searchFrames: '/search-frames',
      fetchUserImages: '/your-uploads/get-user-images',
      uploadUserImage: '/your-uploads/upload',
      removeUserImage: '/your-uploads/remove',
      templateKeywordSuggestion: '/template-suggestion',
      textKeywordSuggestion: '/text-suggestion',
      imageKeywordSuggestion: '/image-suggestion',
      shapeKeywordSuggestion: '/shape-suggestion',
      frameKeywordSuggestion: '/frame-suggestion'
    },
    unsplash: { accessKey: '', pageSize: 30 }, // disabled: image search is proxied server-side
    editorAssetsUrl: '/editor-assets',
    mergeFields: opts.fields, // consumed by Task 11
    translations: {}
  };
}
