interface RichTextDisplayProps {
  content: string;
  className?: string;
}

export default function RichTextDisplay({ content, className = '' }: RichTextDisplayProps) {
  return (
    <>
      <style>{`
        .rich-text-display {
          color: #374151; /* gray-700 default color */
        }
        .rich-text-display h1 {
          font-size: 1.875rem;
          font-weight: 700;
          line-height: 2.25rem;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
        }
        .rich-text-display h2 {
          font-size: 1.5rem;
          font-weight: 600;
          line-height: 2rem;
          margin-top: 0.875rem;
          margin-bottom: 0.5rem;
        }
        .rich-text-display h3 {
          font-size: 1.25rem;
          font-weight: 600;
          line-height: 1.75rem;
          margin-top: 0.75rem;
          margin-bottom: 0.5rem;
        }
        .rich-text-display p {
          margin-bottom: 0.875rem;
          line-height: 1.625;
        }
        .rich-text-display ul, .rich-text-display ol {
          padding-left: 1.5rem;
          margin-bottom: 0.875rem;
        }
        .rich-text-display ul {
          list-style-type: disc;
        }
        .rich-text-display ol {
          list-style-type: decimal;
        }
        .rich-text-display li {
          margin-bottom: 0.5rem;
        }
        .rich-text-display a {
          color: #2563eb !important;
          text-decoration: underline;
        }
        .rich-text-display a:hover {
          color: #1d4ed8 !important;
        }
        .rich-text-display strong {
          font-weight: 700;
        }
        .rich-text-display em {
          font-style: italic;
        }
        .rich-text-display u {
          text-decoration: underline;
        }
        .rich-text-display s {
          text-decoration: line-through;
        }
      `}</style>
      <div 
        className={`rich-text-display ${className}`}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </>
  );
}
