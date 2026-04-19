import { isValidElement, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";

interface MarkdownPreviewProps {
  content: string;
}

/**
 * README 实时渲染组件：
 * - 支持 GFM（表格、任务列表、删除线）
 * - 支持 README 中内嵌的 HTML 片段
 * - 支持 fenced code block 语法高亮
 */
export function MarkdownPreview(props: MarkdownPreviewProps) {
  return (
    <div className="readme-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeHighlight]}
        components={{
          pre({ children }) {
            return <MarkdownCodeBlock>{children}</MarkdownCodeBlock>;
          }
        }}
      >
        {props.content}
      </ReactMarkdown>
    </div>
  );
}

function MarkdownCodeBlock(props: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);

  const codeText = extractText(props.children).replace(/\n$/, "");

  async function handleCopy(): Promise<void> {
    if (!codeText) {
      return;
    }
    await navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="readme-code-block">
      <button className="readme-copy-btn" type="button" onClick={() => void handleCopy()}>
        {copied ? "已复制" : "复制代码"}
      </button>
      <pre>{props.children}</pre>
    </div>
  );
}

function extractText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join("");
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractText(node.props.children);
  }
  return "";
}
