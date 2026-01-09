import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Renders markdown content with GFM (GitHub Flavored Markdown) support.
 * Supports tables, strikethrough, task lists, and other GFM features.
 */
export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  if (!content) {
    return <span className="text-gray-400 italic">No content</span>;
  }

  return (
    <div className={`prose prose-sm max-w-none text-gray-700 ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
