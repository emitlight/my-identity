import React from "react";

/**
 * 아주 작은 Markdown 조판기.
 *
 * 라이브러리를 쓰지 않는다. 필요한 것은 제목·강조·목록·인용·링크가
 * 전부인데, 그걸 위해 파서와 HTML 살균기를 함께 들이면 번들이 커지고
 * dangerouslySetInnerHTML 을 쓰게 된다. 여기서는 React 요소를 직접
 * 만들므로 HTML 이 끼어들 자리가 없다.
 */

/** **굵게** · *기울임* · `코드` · [글자](주소) */
function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith("**")) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`"))
      out.push(
        <code key={k} className="bg-key-soft px-1.5 py-0.5 text-[.92em]">
          {t.slice(1, -1)}
        </code>,
      );
    else if (t.startsWith("[")) {
      const cut = t.indexOf("](");
      out.push(
        <a
          key={k}
          href={t.slice(cut + 2, -1)}
          className="underline decoration-key decoration-2 underline-offset-2 hover:text-key-ink"
          target="_blank"
          rel="noreferrer noopener"
        >
          {t.slice(1, cut)}
        </a>,
      );
    } else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** 본문을 문단 단위로 끊어 조판한다 */
export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: React.ReactNode[] = [];
  let para: string[] = [];
  let list: string[] = [];
  let quote: string[] = [];

  const flushPara = () => {
    if (!para.length) return;
    const k = `p${out.length}`;
    out.push(
      <p key={k} className="text-[15.5px] leading-[1.85] lg:text-[17px]">
        {inline(para.join(" "), k)}
      </p>,
    );
    para = [];
  };
  const flushList = () => {
    if (!list.length) return;
    const k = `l${out.length}`;
    out.push(
      <ul key={k} className="flex flex-col gap-2">
        {list.map((li, i) => (
          <li key={i} className="flex gap-3 text-[15.5px] leading-[1.8] lg:text-[17px]">
            <span aria-hidden className="mt-[.62em] h-[2px] w-3 shrink-0 bg-key-ink" />
            <span>{inline(li, `${k}-${i}`)}</span>
          </li>
        ))}
      </ul>,
    );
    list = [];
  };
  const flushQuote = () => {
    if (!quote.length) return;
    const k = `q${out.length}`;
    out.push(
      <blockquote
        key={k}
        className="krd border-l-[3px] border-key-ink pl-5 text-[19px] leading-[1.6] lg:text-[24px]"
      >
        {inline(quote.join(" "), k)}
      </blockquote>,
    );
    quote = [];
  };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) { flushAll(); continue; }

    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flushAll();
      const size = h[1].length === 1 ? "text-[26px] lg:text-[34px]"
                 : h[1].length === 2 ? "text-[21px] lg:text-[27px]"
                 : "text-[18px] lg:text-[21px]";
      out.push(
        <h2 key={`h${out.length}`} className={`krd mt-2 ${size}`}>
          {inline(h[2], `h${out.length}`)}
        </h2>,
      );
      continue;
    }

    if (/^(---+|\*\*\*+)$/.test(line.trim())) {
      flushAll();
      out.push(<hr key={`r${out.length}`} className="my-2 h-[3px] w-full border-0 bg-ink" />);
      continue;
    }

    const li = /^[-*]\s+(.*)$/.exec(line);
    if (li) { flushPara(); flushQuote(); list.push(li[1]); continue; }

    const q = /^>\s?(.*)$/.exec(line);
    if (q) { flushPara(); flushList(); quote.push(q[1]); continue; }

    flushList(); flushQuote();
    para.push(line.trim());
  }
  flushAll();

  return <div className="flex flex-col gap-5 lg:gap-6">{out}</div>;
}

/** 목록에 뽑는 한 줄. 표식을 걷어내고 첫 문장만. */
export function excerpt(body: string, max = 90): string {
  const plain = body
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/^[->*]\s+/gm, "")
    .replace(/\*\*|`|\*/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > max ? plain.slice(0, max).trimEnd() + "…" : plain;
}
