import { useEffect, useRef, useState } from 'react';
import { Button, Card, Input, Logo, TextLink } from '../ui/kit';
import { VerifyResult, useVerifier } from './admin/AuditLog';
import { isCloudConfigured } from '../lib/store';

export function Verify({ code }: { code?: string }) {
  const v = useVerifier();
  const [input, setInput] = useState(code || '');
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (code) v.byId(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);
  return (
    <div className="min-h-screen bg-blush flex flex-col items-center px-4 py-10">
      <Logo className="text-[44px]" />
      <Card className="w-full max-w-[640px] mt-6 p-6 sm:p-8 rounded-[16px]">
        <h1 className="text-[28px] font-extrabold">Verify a document</h1>
        <p className="text-mauve mt-1 mb-5">Enter the ID printed beside the QR code, or upload the PDF to check its fingerprint.</p>
        <form
          className="flex flex-col sm:flex-row gap-2.5"
          onSubmit={e => {
            e.preventDefault();
            v.byId(input);
          }}
        >
          <Input aria-label="Document ID" value={input} onChange={e => setInput(e.target.value)} placeholder="e.g. EZ-2026-0398" className="flex-1" />
          <Button type="submit" size="lg" disabled={!input.trim()}>
            Verify
          </Button>
          <Button type="button" variant="outline" size="lg" loading={v.busy} onClick={() => fileRef.current?.click()}>
            Upload PDF
          </Button>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={e => void v.byFile(e.target.files?.[0])} />
        </form>
        {v.result !== undefined && (
          <div className="mt-5 rounded-[12px] bg-sky p-3">
            <VerifyResult app={v.result} query={v.query} />
          </div>
        )}
        {v.result === null && !isCloudConfigured() && (
          <p className="text-sm text-mauve mt-3">This site is running without a shared database, so only documents issued in this browser can be looked up. Connect Supabase to verify from any device.</p>
        )}
      </Card>
      <p className="mt-6">
        <TextLink to="/">← EzScene home</TextLink>
      </p>
    </div>
  );
}
