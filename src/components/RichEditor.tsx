"use client";
import { useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Extension, Mark, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { TableKit } from "@tiptap/extension-table";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import {
  Bold,
  Italic,
  Underline,
  Heading2,
  List,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignJustify,
  ImagePlus,
  Undo2,
  Redo2,
} from "lucide-react";
import { cleanHtml } from "../lib/sanitize";
import { uploadAsset } from "../lib/uploads";
import { tx } from "../lib/content";
import type { Locale } from "../lib/types";
const NoteIds = Extension.create({
  name: "noteIds",
  addGlobalAttributes() {
    return [
      {
        types: [
          "paragraph",
          "heading",
          "blockquote",
          "listItem",
          "table",
          "tableCell",
          "tableHeader",
          "image",
          "link",
        ],
        attributes: {
          id: {
            default: null,
            parseHTML: (element) => element.getAttribute("id"),
            renderHTML: (attrs) => (attrs.id ? { id: attrs.id } : {}),
          },
        },
      },
    ];
  },
});
const AnchorSpan = Mark.create({
  name: "anchorSpan",
  addAttributes() {
    return { id: { default: null } };
  },
  parseHTML() {
    return [{ tag: "span[id]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },
});
export default function RichEditor({
  html,
  onChange,
  locale,
  onError,
  onBusyChange,
}: {
  html: string;
  onChange: (value: string) => void;
  locale: Locale;
  onError: (error: string) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [mode, setMode] = useState("visual"),
    [uploading, setUploading] = useState(false);
  const [previewDevice, setPreviewDevice] = useState("mobile");
  const input = useRef<HTMLInputElement>(null);
  const L = (vi: string, en: string) => tx(locale, vi, en);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ allowBase64: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TableKit,
      Superscript,
      Subscript,
      NoteIds,
      AnchorSpan,
    ],
    content: html,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { "aria-label": L("Nội dung chương", "Chapter content") },
    },
  });
  function changeMode(value: string) {
    if (value === "visual" && mode !== "visual")
      editor?.commands.setContent(cleanHtml(html), { emitUpdate: false });
    setMode(value);
  }
  async function image(file?: File) {
    if (!file) return;
    setUploading(true);
    onBusyChange?.(true);
    try {
      const result = await uploadAsset(file, file.name);
      editor
        ?.chain()
        .focus()
        .setImage({ src: result.url, alt: file.name.replace(/\.[^.]+$/, "") })
        .run();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      onBusyChange?.(false);
    }
  }
  const actions = [
    {
      Icon: Bold,
      label: L("In đậm", "Bold"),
      name: "bold",
      run: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      Icon: Italic,
      label: L("In nghiêng", "Italic"),
      name: "italic",
      run: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      Icon: Underline,
      label: L("Gạch chân", "Underline"),
      name: "underline",
      run: () => editor?.chain().focus().toggleUnderline().run(),
    },
    {
      Icon: Heading2,
      label: L("Tiêu đề phụ", "Subheading"),
      name: "heading",
      run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      Icon: List,
      label: L("Danh sách", "Bullet list"),
      name: "bulletList",
      run: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      Icon: Quote,
      label: L("Trích dẫn", "Blockquote"),
      name: "blockquote",
      run: () => editor?.chain().focus().toggleBlockquote().run(),
    },
    {
      Icon: AlignLeft,
      label: L("Căn trái", "Align left"),
      run: () => editor?.chain().focus().setTextAlign("left").run(),
    },
    {
      Icon: AlignCenter,
      label: L("Căn giữa", "Align center"),
      run: () => editor?.chain().focus().setTextAlign("center").run(),
    },
    {
      Icon: AlignJustify,
      label: L("Căn đều", "Justify"),
      run: () => editor?.chain().focus().setTextAlign("justify").run(),
    },
    {
      Icon: Undo2,
      label: L("Hoàn tác", "Undo"),
      run: () => editor?.chain().focus().undo().run(),
    },
    {
      Icon: Redo2,
      label: L("Làm lại", "Redo"),
      run: () => editor?.chain().focus().redo().run(),
    },
  ];
  return (
    <div>
      <div className="editor-controls">
        {actions.map(({ Icon, label, name, run }) => (
          <button
            key={label}
            type="button"
            data-tooltip={label}
            aria-label={label}
            className={name && editor?.isActive(name) ? "active" : ""}
            disabled={!editor || mode !== "visual"}
            onClick={run}
          >
            <Icon size={16} />
          </button>
        ))}
        <button
          aria-label={L("Chèn ảnh", "Insert image")}
          data-tooltip={L("Chèn ảnh", "Insert image")}
          disabled={uploading || mode !== "visual"}
          onClick={() => input.current?.click()}
        >
          <ImagePlus size={17} />
        </button>
        <input
          ref={input}
          type="file"
          hidden
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => {
            image(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <div className="editor-modes">
          {[
            ["visual", L("Trực quan", "Visual")],
            ["html", "HTML"],
            ["preview", L("Xem trước", "Preview")],
          ].map(([id, label]) => (
            <button
              key={id}
              className={mode === id ? "selected" : ""}
              onClick={() => changeMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {mode === "visual" ? (
        <EditorContent editor={editor} />
      ) : mode === "html" ? (
        <textarea
          className="html-editor"
          aria-label="HTML"
          value={html}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      ) : (
        <div className="editor-device-preview">
          <div
            className="segmented"
            aria-label={L("Khung xem trước", "Preview viewport")}
          >
            {[
              ["mobile", L("Điện thoại", "Phone")],
              ["desktop", L("Máy tính", "Desktop")],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={previewDevice === id}
                className={previewDevice === id ? "selected" : ""}
                onClick={() => setPreviewDevice(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="tiny muted">
            {L(
              "Xem trước nội dung; cài đặt đọc thực tế tùy thiết bị người đọc.",
              "Content preview; actual reading settings depend on the reader’s device.",
            )}
          </p>
          <div className="editor-preview-scroll">
            <div
              className="editor-preview prose"
              data-device={previewDevice}
              style={{ width: previewDevice === "mobile" ? 390 : 780 }}
              dangerouslySetInnerHTML={{ __html: cleanHtml(html) }}
            />
          </div>
        </div>
      )}
      {uploading && (
        <p role="status">{L("Đang tải ảnh…", "Uploading image…")}</p>
      )}
    </div>
  );
}
