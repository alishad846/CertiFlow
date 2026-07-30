import { FC } from 'react';
import { SearchBox } from 'canva-editor/search-autocomplete';
import useMobileDetect from 'canva-editor/hooks/useMobileDetect';
import { useTranslate } from 'canva-editor/contexts/TranslationContext';

interface Props {
  searchString: string;
  onStartSearch: (kw: string) => void;
}
const ImageSearchBox: FC<Props> = ({ searchString, onStartSearch }) => {
  const isMobile = useMobileDetect();
  const t = useTranslate();

  // Stock image search has no autocomplete suggestion service, so the search box triggers the
  // actual stock-image query directly: `onSearch` fires (debounced) as the user types and on Enter,
  // and `onSelect` covers a suggestion click. Both route to `onStartSearch`, which runs the query.
  const runSearch = (keyword: string) => {
    onStartSearch((keyword ?? '').trim());
  };

  const handleOnHover = () => {};
  const handleOnFocus = () => {};

  return (
    <SearchBox
      items={[]}
      inputSearchString={searchString}
      placeholder={t('sidebar.searchImage', 'Search stock images')}
      inputDebounce={600}
      showNoResults={false}
      onSearch={runSearch}
      onHover={handleOnHover}
      onSelect={(item: any) => runSearch(item?.name ?? '')}
      onFocus={handleOnFocus}
      onClear={() => onStartSearch('')}
      autoFocus={!isMobile}
      styling={{ zIndex: 2 }}
    />
  );
};

export default ImageSearchBox;
