/**
 * Editorial review inventory — PREVIEW ONLY.
 *
 * The `.preview.tsx` extension is only registered as a page extension when
 * NEXT_PUBLIC_SHOW_DRAFTS is not "false" (see next.config.ts). In a production
 * build Next does not recognise this file as a route at all, so no HTML, RSC
 * payload, index entry or manifest reference is generated for it.
 *
 * That is deliberate structure rather than concealment: these routes display
 * withheld dossier bodies, unreviewed rule wording, decision logs and reviewer
 * names in full. Hiding a nav link or adding a robots rule would leave the
 * content served, which is not access control.
 */
export { ReviewInventory as default } from '../../components/review/Inventory.tsx';
