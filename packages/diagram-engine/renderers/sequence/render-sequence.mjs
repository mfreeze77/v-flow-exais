// Compatibility CLI: all geometry comes from the shared compilation API.
import { runRenderer } from '../shared/render-cli.mjs';
await runRenderer('sequence', 'cache-miss-request.sequence.json');
