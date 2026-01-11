import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Renders markdown content with GFM (GitHub Flavored Markdown) support.
 * Supports tables, strikethrough, task lists, and other GFM features.
 *
 * Table syntax example:
 * | Header1 | Header2 |
 * |---------|---------|
 * | Cell 1  | Cell 2  |
 */
export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  if (!content) {
    return <span className="text-gray-400 italic">No content</span>;
  }

  return (
    <div
      className={`prose prose-sm max-w-none text-gray-700
        prose-table:border-collapse prose-table:w-full
        prose-th:border prose-th:border-gray-300 prose-th:bg-gray-100 prose-th:px-3 prose-th:py-2 prose-th:text-left
        prose-td:border prose-td:border-gray-300 prose-td:px-3 prose-td:py-2
        prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
        prose-pre:bg-gray-900 prose-pre:text-gray-100
        ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
