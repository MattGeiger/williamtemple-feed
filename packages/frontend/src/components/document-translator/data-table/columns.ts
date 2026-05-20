import { getColumns } from './columns.tsx';

export { getColumns };

// Create a wrapper function that matches what DocumentList expects
export const columns = (props: {
  onEdit: (document: any) => void;
  onDelete: (document: any) => void;
  onTranslate: (document: any) => void;
  onDownload: (document: any) => void;
  onDownloadAllTranslations: (document: any) => Promise<void>;
}) => {
  return getColumns(
    props.onEdit,
    props.onDelete,
    props.onTranslate,
    props.onDownload,
    props.onDownloadAllTranslations
  );
};