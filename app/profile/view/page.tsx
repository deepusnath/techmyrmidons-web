import { SharedProfileView } from '../../../components/SharedProfileView.tsx';

/**
 * Viewer for shared profile snapshots. The data arrives in the URL fragment,
 * which never reaches the server — this route is a static shell that decodes
 * client-side. See lib/profileShare.ts for the validation stance.
 */
export default function SharedProfilePage() {
  return <SharedProfileView />;
}
