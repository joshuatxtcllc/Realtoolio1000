import RealToolSkipTrace from '../src/RealTool.js';

// Basic example
const realTool = new RealToolSkipTrace(
    process.env.GOOGLE_SPREADSHEET_ID,
    process.env.GOOGLE_SHEETS_API_KEY,
    process.env.OPENAI_API_KEY
);

await realTool.loadAndScoreLeads();
realTool.showTopLeads(10);
