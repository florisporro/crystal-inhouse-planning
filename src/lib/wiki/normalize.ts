import { MarkdownManager } from '@tiptap/markdown';
import { extensions } from './extensions';

const md = new MarkdownManager({ extensions });

// round-trip through the editor's serializer so stored markdown matches what the
// editor writes back; otherwise a one-word edit would diff as a rewrite
export const normalize = (body: string) => md.serialize(md.parse(body)).trim() + '\n';
