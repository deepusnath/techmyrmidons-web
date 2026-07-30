import { SubmissionForm } from '../../components/SubmissionForm.tsx';

export default function SubmitPage() {
  return (
    <div className="max-w-2xl">
      <header className="mb-8">
        <h1 className="mb-2 text-3xl">Share a tool or resource</h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-dim)' }}>
          Suggest something the Frontend Myrmidon should be tracking. Submissions are queued in your
          browser — an editor reviews them before anything is published, because a catalogue that
          anyone can write to directly is a link list, not a curated landscape.
        </p>
      </header>
      <SubmissionForm />
    </div>
  );
}
