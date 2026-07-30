import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect, useState } from 'react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { 
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, 
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight, 
  Link2, Palette, Heading1, Heading2, Heading3, X
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: string;
  tokenDefinitions?: RichTextTokenDefinition[];
}

export interface RichTextTokenDefinition {
  token: string;
  label: string;
  description: string;
  example: string;
  missingBehavior: string;
  category: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Escreva aqui...',
  height = '300px',
  tokenDefinitions = [],
}: RichTextEditorProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showTokenPicker, setShowTokenPicker] = useState(false);
  const [tokenSearch, setTokenSearch] = useState('');
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      TextStyle,
      Color,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none px-4 py-3',
        style: `min-height: ${height}; max-height: 500px; overflow-y: auto;`,
      },
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || '');
    }
  }, [editor, value]);

  if (!editor) {
    return null;
  }

  const colors = [
    '#000000', '#4B5563', '#6B7280', '#9CA3AF', // Grays
    '#EF4444', '#F59E0B', '#10B981', '#3B82F6', // Primary colors
    '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', // Secondary colors
    '#DC2626', '#FACC15', '#22C55E', '#2563EB', // Bright
  ];

  const openLinkModal = () => {
    const previousUrl = editor.getAttributes('link').href || '';
    setLinkUrl(previousUrl);
    setShowLinkModal(true);
  };

  const applyLink = () => {
    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    }
    setShowLinkModal(false);
    setLinkUrl('');
  };

  const removeLink = () => {
    editor.chain().focus().unsetLink().run();
    setShowLinkModal(false);
    setLinkUrl('');
  };

  const applyColor = (color: string) => {
    editor.chain().focus().setColor(color).run();
    setShowColorPicker(false);
  };

  const filteredTokens = tokenDefinitions.filter((definition) => {
    const query = tokenSearch.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return [definition.token, definition.label, definition.description, definition.category]
      .some((entry) => entry.toLowerCase().includes(query));
  });

  const groupedTokens = filteredTokens.reduce<Record<string, RichTextTokenDefinition[]>>((groups, definition) => {
    groups[definition.category] = [...(groups[definition.category] || []), definition];
    return groups;
  }, {});

  const insertToken = (token: string) => {
    editor.chain().focus().insertContent(token).run();
  };

  return (
    <div className="rich-text-editor border border-line rounded-lg bg-surface">
      {/* Toolbar */}
      <div className="border-b border-line bg-surface-muted px-3 py-2 flex flex-wrap gap-1 rounded-t-lg">
        {/* Headings */}
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1.5 rounded hover:bg-control-hover transition ${editor.isActive('heading', { level: 1 }) ? 'bg-blue-100 text-blue-600' : 'text-ink-muted'}`}
          title="Título 1"
          type="button"
        >
          <Heading1 className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded hover:bg-control-hover transition ${editor.isActive('heading', { level: 2 }) ? 'bg-blue-100 text-blue-600' : 'text-ink-muted'}`}
          title="Título 2"
          type="button"
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-1.5 rounded hover:bg-control-hover transition ${editor.isActive('heading', { level: 3 }) ? 'bg-blue-100 text-blue-600' : 'text-ink-muted'}`}
          title="Título 3"
          type="button"
        >
          <Heading3 className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-line mx-1" />

        {/* Text Formatting */}
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded hover:bg-control-hover transition ${editor.isActive('bold') ? 'bg-blue-100 text-blue-600' : 'text-ink-muted'}`}
          title="Negrito"
          type="button"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded hover:bg-control-hover transition ${editor.isActive('italic') ? 'bg-blue-100 text-blue-600' : 'text-ink-muted'}`}
          title="Itálico"
          type="button"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-1.5 rounded hover:bg-control-hover transition ${editor.isActive('underline') ? 'bg-blue-100 text-blue-600' : 'text-ink-muted'}`}
          title="Sublinhado"
          type="button"
        >
          <UnderlineIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-1.5 rounded hover:bg-control-hover transition ${editor.isActive('strike') ? 'bg-blue-100 text-blue-600' : 'text-ink-muted'}`}
          title="Riscado"
          type="button"
        >
          <Strikethrough className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-line mx-1" />

        {/* Color */}
        <div className="relative">
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="p-1.5 rounded hover:bg-control-hover transition text-ink-muted"
            title="Cor do texto"
            type="button"
          >
            <Palette className="w-4 h-4" />
          </button>
          
          {showColorPicker && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowColorPicker(false)} />
              <div className="absolute top-full left-0 mt-1 bg-surface rounded-lg shadow-lg border border-line p-2 z-50">
                <div className="grid grid-cols-4 gap-1">
                  {colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => applyColor(color)}
                      className="w-8 h-8 rounded border-2 border-line hover:border-blue-500 transition"
                      style={{ backgroundColor: color }}
                      title={color}
                      type="button"
                    />
                  ))}
                </div>
                <button
                  onClick={() => {
                    editor.chain().focus().unsetColor().run();
                    setShowColorPicker(false);
                  }}
                  className="mt-2 w-full px-2 py-1 text-xs text-ink-muted hover:bg-surface-hover rounded"
                  type="button"
                >
                  Remover cor
                </button>
              </div>
            </>
          )}
        </div>

        <div className="w-px h-6 bg-line mx-1" />

        {/* Lists */}
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded hover:bg-control-hover transition ${editor.isActive('bulletList') ? 'bg-blue-100 text-blue-600' : 'text-ink-muted'}`}
          title="Lista com marcadores"
          type="button"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded hover:bg-control-hover transition ${editor.isActive('orderedList') ? 'bg-blue-100 text-blue-600' : 'text-ink-muted'}`}
          title="Lista numerada"
          type="button"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-line mx-1" />

        {/* Alignment */}
        <button
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`p-1.5 rounded hover:bg-control-hover transition ${editor.isActive({ textAlign: 'left' }) ? 'bg-blue-100 text-blue-600' : 'text-ink-muted'}`}
          title="Alinhar à esquerda"
          type="button"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`p-1.5 rounded hover:bg-control-hover transition ${editor.isActive({ textAlign: 'center' }) ? 'bg-blue-100 text-blue-600' : 'text-ink-muted'}`}
          title="Centralizar"
          type="button"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`p-1.5 rounded hover:bg-control-hover transition ${editor.isActive({ textAlign: 'right' }) ? 'bg-blue-100 text-blue-600' : 'text-ink-muted'}`}
          title="Alinhar à direita"
          type="button"
        >
          <AlignRight className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-line mx-1" />

        {/* Link */}
        <button
          onClick={openLinkModal}
          className={`p-1.5 rounded hover:bg-control-hover transition ${editor.isActive('link') ? 'bg-blue-100 text-blue-600' : 'text-ink-muted'}`}
          title="Inserir link"
          type="button"
        >
          <Link2 className="w-4 h-4" />
        </button>

        {tokenDefinitions.length > 0 && (
          <>
            <div className="w-px h-6 bg-line mx-1" />
            <button
              onClick={() => setShowTokenPicker((current) => !current)}
              className={`px-2.5 py-1.5 rounded hover:bg-control-hover transition text-xs font-semibold ${showTokenPicker ? 'bg-blue-100 text-blue-600' : 'text-ink-muted'}`}
              title="Inserir tag"
              type="button"
            >
              Tags
            </button>
          </>
        )}
      </div>

      {showTokenPicker && tokenDefinitions.length > 0 && (
        <div className="border-b border-line bg-amber-50/60 px-4 py-3 space-y-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-ink">Inserir Tags do Template</h4>
              <p className="text-xs text-ink-muted">Cada tag mostra o significado, um exemplo real e o comportamento quando não há valor.</p>
            </div>
            <input
              type="text"
              value={tokenSearch}
              onChange={(e) => setTokenSearch(e.target.value)}
              placeholder="Pesquisar tag..."
              className="w-full md:w-64 px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {Object.entries(groupedTokens).map(([category, definitions]) => (
              <div key={category} className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{category}</div>
                <div className="grid gap-2">
                  {definitions.map((definition) => (
                    <button
                      key={definition.token}
                      type="button"
                      onClick={() => insertToken(definition.token)}
                      className="text-left rounded-lg border border-amber-200 bg-surface px-3 py-3 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs text-indigo-700">{definition.token}</span>
                        <span className="text-xs font-medium text-ink">{definition.label}</span>
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">{definition.description}</p>
                      <p className="mt-1 text-xs text-ink-subtle">Exemplo: {definition.example}</p>
                      <p className="mt-1 text-xs text-amber-700">Sem valor: {definition.missingBehavior}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {filteredTokens.length === 0 && (
              <div className="rounded-lg border border-dashed border-line bg-surface px-3 py-4 text-sm text-ink-subtle">
                Nenhuma tag encontrada para a pesquisa.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editor Content */}
      <div className="bg-surface rounded-b-lg" style={{ minHeight: height }}>
        <style>{`
          .ProseMirror {
            min-height: ${height};
            padding: 0.75rem 1rem;
            outline: none;
          }
          .ProseMirror p.is-editor-empty:first-child::before {
            color: #9ca3af;
            content: attr(data-placeholder);
            float: left;
            height: 0;
            pointer-events: none;
          }
          .ProseMirror h1 {
            font-size: 1.875rem;
            font-weight: 700;
            line-height: 2.25rem;
            margin-top: 1rem;
            margin-bottom: 0.5rem;
          }
          .ProseMirror h2 {
            font-size: 1.5rem;
            font-weight: 600;
            line-height: 2rem;
            margin-top: 0.875rem;
            margin-bottom: 0.5rem;
          }
          .ProseMirror h3 {
            font-size: 1.25rem;
            font-weight: 600;
            line-height: 1.75rem;
            margin-top: 0.75rem;
            margin-bottom: 0.5rem;
          }
          .ProseMirror p {
            margin-bottom: 0.5rem;
          }
          .ProseMirror ul, .ProseMirror ol {
            padding-left: 1.5rem;
            margin-bottom: 0.5rem;
          }
          .ProseMirror ul {
            list-style-type: disc;
          }
          .ProseMirror ol {
            list-style-type: decimal;
          }
          .ProseMirror li {
            margin-bottom: 0.25rem;
          }
          .ProseMirror a {
            color: #2563eb;
            text-decoration: underline;
          }
          .ProseMirror strong {
            font-weight: 700;
          }
          .ProseMirror em {
            font-style: italic;
          }
          .ProseMirror u {
            text-decoration: underline;
          }
          .ProseMirror s {
            text-decoration: line-through;
          }
        `}</style>
        <EditorContent editor={editor} />
      </div>

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={() => setShowLinkModal(false)}>
          <div className="bg-surface rounded-xl shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-line">
              <h3 className="text-lg font-semibold text-ink">Inserir Link</h3>
              <button onClick={() => setShowLinkModal(false)} className="p-1 hover:bg-surface-hover rounded-lg transition-colors">
                <X className="w-5 h-5 text-ink-subtle" />
              </button>
            </div>
            <div className="px-6 py-4">
              <label className="block text-sm font-medium text-ink-muted mb-2">
                URL
              </label>
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://exemplo.com"
                className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    applyLink();
                  }
                }}
              />
            </div>
            <div className="px-6 py-4 border-t border-line flex justify-between gap-3">
              <button
                onClick={removeLink}
                className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Remover Link
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLinkModal(false)}
                  className="px-4 py-2 text-sm text-ink-muted hover:text-ink"
                >
                  Cancelar
                </button>
                <button
                  onClick={applyLink}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
