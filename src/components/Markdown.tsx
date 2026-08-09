"use client";

import {
  isValidElement,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactElement,
  type TableHTMLAttributes,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy } from "lucide-react";

const SAFE_URL_PATTERN = /^(https?:|mailto:|tel:|#|\/(?!\/))/i;

function isSafeHref(href: string | undefined): boolean {
  if (!href) return false;
  return SAFE_URL_PATTERN.test(href.trim());
}

function CopyButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(getText());
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard unavailable, ignore
        }
      }}
      className="flex items-center gap-1 text-[11.5px] text-tertiary hover:opacity-70"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "복사됨" : "복사"}
    </button>
  );
}

type CodeElement = ReactElement<{ className?: string }>;

function CodeBlockPre(props: HTMLAttributes<HTMLPreElement>) {
  const { children } = props;
  const preRef = useRef<HTMLPreElement>(null);

  const codeElement = isValidElement(children) ? (children as CodeElement) : null;
  const language = /language-(\w+)/.exec(codeElement?.props.className ?? "")?.[1] ?? "text";

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-line">
      <div className="flex items-center justify-between bg-code-header px-3.5 py-2 font-mono text-[11.5px] text-code-text">
        <span>{language}</span>
        <CopyButton getText={() => preRef.current?.innerText ?? ""} />
      </div>
      <pre ref={preRef} className="overflow-x-auto bg-code p-3.5 text-[13px] leading-relaxed">
        {children}
      </pre>
    </div>
  );
}

function LinkRenderer(props: HTMLAttributes<HTMLAnchorElement> & { href?: string }) {
  const { href, children, ...rest } = props;
  if (!isSafeHref(href)) {
    // Untrusted/unsafe scheme (javascript:, data:, vbscript:, ...) — render as inert text.
    return <span {...rest}>{children}</span>;
  }
  return (
    <a {...rest} href={href} target="_blank" rel="noopener noreferrer nofollow">
      {children}
    </a>
  );
}

function TableRenderer(props: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="table-scroll">
      <table {...props} />
    </div>
  );
}

export default function Markdown({ content }: { content: string }) {
  return (
    <div className="markdown-body leading-[1.7]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          pre: CodeBlockPre,
          a: LinkRenderer,
          table: TableRenderer,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
