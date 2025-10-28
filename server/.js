// ========================================
// GOOGLE SHEETS SKIP TRACE CONNECTOR
// ========================================

class SkipTraceConnector {
    constructor(config) {
        this.spreadsheetId = config.spreadsheetId;
        this.apiKey = config.apiKey; // Google Sheets API key
        this.sheetName = config.sheetName || 'Sheet1';
        this.range = config.range || 'A:Z'; // Default to all columns
    }

    // Fetch skip trace data from Google Sheets
    async fetchSkipTraceData() {
        try {
            console.log(`📊 Fetching skip trace data from Google Sheets...`);
            
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${this.sheetName}!${this.range}?key=${this.apiKey}`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Google Sheets API Error: ${response.status} - ${await response.text()}`);
            }

            const data = await response.json();
            const rows = data.values || [];
            
            if (rows.length === 0) {
                console.log("⚠️ No data found in spreadsheet");
                return [];
            }

            // Convert rows to lead objects
            const headers = rows[0].map(h => h.toLowerCase().trim());
            const leads = rows.slice(1).map((row, index) => {
                const lead = { rowNumber: index + 2 }; // +2 because of header and 1-indexing
                
                headers.forEach((header, colIndex) => {
                    lead[header] = row[colIndex] || '';
                });
                
                return lead;
            });

            console.log(`✅ Loaded ${leads.length} leads from skip trace list`);
            return this.normalizeSkipTraceData(leads);
            
        } catch (error) {
            console.error("Failed to fetch skip trace data:", error);
            return [];
        }
    }

    // Normalize skip trace data to standard format
    normalizeSkipTraceData(rawLeads) {
        return rawLeads.map(lead => {
            // Common skip trace field mappings
            return {
                // Basic Info
                id: lead.id || lead.row_id || lead.rownumber,
                rowNumber: lead.rowNumber,
                
                // Owner/Contact Info
                ownerName: lead.owner_name || lead.owner || lead.name || lead.first_name + ' ' + lead.last_name,
                firstName: lead.first_name || lead.firstname || '',
                lastName: lead.last_name || lead.lastname || '',
                
                // Contact Details
                phone1: lead.phone || lead.phone_1 || lead.phone1 || lead.primary_phone || '',
                phone2: lead.phone_2 || lead.phone2 || lead.alternate_phone || '',
                phone3: lead.phone_3 || lead.phone3 || '',
                email: lead.email || lead.email_address || '',
                
                // Property Address
                address: lead.address || lead.property_address || lead.full_address || '',
                street: lead.street || lead.street_address || '',
                city: lead.city || '',
                state: lead.state || '',
                zip: lead.zip || lead.zipcode || lead.zip_code || '',
                county: lead.county || '',
                
                // Property Details
                propertyType: lead.property_type || lead.type || '',
                bedrooms: parseInt(lead.bedrooms || lead.beds || 0),
                bathrooms: parseFloat(lead.bathrooms || lead.baths || 0),
                squareFeet: parseInt(lead.square_feet || lead.sqft || lead.square_footage || 0),
                yearBuilt: parseInt(lead.year_built || lead.year || 0),
                lotSize: parseFloat(lead.lot_size || lead.lot_sqft || 0),
                
                // Financial Data
                assessedValue: parseFloat(lead.assessed_value || lead.tax_assessed_value || 0),
                marketValue: parseFloat(lead.market_value || lead.estimated_value || 0),
                lastSalePrice: parseFloat(lead.last_sale_price || lead.sale_price || 0),
                lastSaleDate: lead.last_sale_date || lead.sale_date || '',
                
                // Mortgage/Equity Info
                estimatedMortgage: parseFloat(lead.estimated_mortgage || lead.mortgage || 0),
                estimatedEquity: parseFloat(lead.estimated_equity || lead.equity || 0),
                lienAmount: parseFloat(lead.lien_amount || lead.liens || 0),
                
                // Tax Info
                taxAmount: parseFloat(lead.tax_amount || lead.annual_tax || lead.property_tax || 0),
                taxDelinquent: (lead.tax_delinquent || lead.delinquent || '').toLowerCase() === 'yes' || 
                               (lead.tax_delinquent || lead.delinquent || '').toLowerCase() === 'true',
                
                // Owner Characteristics
                ownerOccupied: (lead.owner_occupied || lead.occupied || '').toLowerCase() === 'yes',
                absenteeOwner: (lead.absentee_owner || lead.absentee || '').toLowerCase() === 'yes',
                outOfStateOwner: (lead.out_of_state || lead.out_of_state_owner || '').toLowerCase() === 'yes',
                
                // Property Status
                vacant: (lead.vacant || '').toLowerCase() === 'yes',
                foreclosure: (lead.foreclosure || lead.pre_foreclosure || '').toLowerCase() === 'yes',
                preForeclosure: (lead.pre_foreclosure || '').toLowerCase() === 'yes',
                
                // List Status
                daysOnMarket: parseInt(lead.days_on_market || lead.dom || 0),
                listed: (lead.listed || lead.mls_status || '').toLowerCase() === 'yes' ||
                        (lead.listed || lead.mls_status || '').toLowerCase() === 'active',
                listingStatus: lead.listing_status || lead.mls_status || '',
                listPrice: parseFloat(lead.list_price || lead.asking_price || 0),
                
                // Additional Motivators
                distressIndicators: this.identifyDistressIndicators(lead),
                
                // Custom fields for tracking
                lastContactDate: lead.last_contact || lead.last_contact_date || '',
                contactAttempts: parseInt(lead.contact_attempts || lead.attempts || 0),
                leadStatus: lead.status || lead.lead_status || 'New',
                notes: lead.notes || lead.comments || '',
                assignedTo: lead.assigned_to || lead.agent || '',
                
                // Keep raw data
                rawData: lead
            };
        });
    }

    // Identify distress indicators from skip trace data
    identifyDistressIndicators(lead) {
        const indicators = [];
        
        if ((lead.tax_delinquent || '').toLowerCase() === 'yes') indicators.push('Tax Delinquent');
        if ((lead.foreclosure || '').toLowerCase() === 'yes') indicators.push('Foreclosure');
        if ((lead.pre_foreclosure || '').toLowerCase() === 'yes') indicators.push('Pre-Foreclosure');
        if ((lead.vacant || '').toLowerCase() === 'yes') indicators.push('Vacant');
        if ((lead.absentee_owner || '').toLowerCase() === 'yes') indicators.push('Absentee Owner');
        if ((lead.out_of_state || '').toLowerCase() === 'yes') indicators.push('Out of State Owner');
        if (parseFloat(lead.lien_amount || 0) > 0) indicators.push('Has Liens');
        if (parseInt(lead.days_on_market || 0) > 180) indicators.push('Stale Listing');
        
        const yearBuilt = parseInt(lead.year_built || 0);
        if (yearBuilt > 0 && yearBuilt < 1980) indicators.push('Older Property');
        
        const equity = parseFloat(lead.estimated_equity || 0);
        const value = parseFloat(lead.market_value || lead.assessed_value || 0);
        if (value > 0 && equity < 0) indicators.push('Underwater');
        
        return indicators;
    }
}

// ========================================
// SKIP TRACE LEAD SCORING SYSTEM
// ========================================

class SkipTraceLeadScorer {
    constructor(weights = {}) {
        // Customizable scoring weights
        this.weights = {
            distressIndicators: weights.distressIndicators || 30,
            equity: weights.equity || 20,
            propertyAge: weights.propertyAge || 10,
            taxDelinquency: weights.taxDelinquency || 15,
            ownershipType: weights.ownershipType || 10,
            timeOnMarket: weights.timeOnMarket || 10,
            contactability: weights.contactability || 5
        };
    }

    // Main scoring function for skip trace leads
    scoreLeads(leads) {
        return leads.map(lead => {
            const scores = {
                distressIndicators: this.scoreDistressIndicators(lead.distressIndicators),
                equity: this.scoreEquity(lead.estimatedEquity, lead.marketValue || lead.assessedValue),
                propertyAge: this.scorePropertyAge(lead.yearBuilt),
                taxDelinquency: this.scoreTaxDelinquency(lead.taxDelinquent, lead.taxAmount),
                ownershipType: this.scoreOwnershipType(lead),
                timeOnMarket: this.scoreTimeOnMarket(lead.daysOnMarket, lead.listed),
                contactability: this.scoreContactability(lead)
            };

            // Calculate weighted total score
            let totalScore = 0;
            let breakdown = {};
            
            Object.keys(scores).forEach(key => {
                const weightedScore = (scores[key] / 100) * this.weights[key];
                totalScore += weightedScore;
                breakdown[key] = {
                    score: scores[key],
                    weight: this.weights[key],
                    weighted: weightedScore.toFixed(2)
                };
            });

            return {
                ...lead,
                likelyToSell: totalScore,
                scoreBreakdown: breakdown,
                priority: this.getPriority(totalScore),
                insights: this.generateInsights(lead, scores, totalScore),
                recommendedAction: this.getRecommendedAction(lead, totalScore),
                estimatedOfferRange: this.calculateOfferRange(lead)
            };
        }).sort((a, b) => b.likelyToSell - a.likelyToSell);
    }

    // Score based on distress indicators
    scoreDistressIndicators(indicators) {
        if (!indicators || indicators.length === 0) return 20;
        
        const highValueIndicators = ['Foreclosure', 'Pre-Foreclosure', 'Tax Delinquent'];
        const mediumValueIndicators = ['Vacant', 'Absentee Owner', 'Has Liens', 'Stale Listing'];
        
        let score = 0;
        
        indicators.forEach(indicator => {
            if (highValueIndicators.includes(indicator)) {
                score += 25;
            } else if (mediumValueIndicators.includes(indicator)) {
                score += 15;
            } else {
                score += 10;
            }
        });
        
        return Math.min(100, score);
    }

    // Score equity position
    scoreEquity(equity, propertyValue) {
        if (!equity || !propertyValue || propertyValue === 0) return 50;
        
        const equityPercent = (equity / propertyValue) * 100;
        
        if (equityPercent < 0) return 95; // Underwater - desperate
        if (equityPercent < 10) return 85;
        if (equityPercent < 20) return 70;
        if (equityPercent < 30) return 60;
        if (equityPercent < 50) return 50;
        if (equityPercent < 70) return 70;
        if (equityPercent >= 70) return 100; // Free and clear - great for creative financing
        
        return 50;
    }

    // Score property age
    scorePropertyAge(yearBuilt) {
        if (!yearBuilt || yearBuilt === 0) return 50;
        
        const age = new Date().getFullYear() - yearBuilt;
        
        if (age >= 80) return 95; // Very old, likely needs work
        if (age >= 60) return 85;
        if (age >= 40) return 75;
        if (age >= 30) return 65;
        if (age >= 20) return 50;
        if (age >= 10) return 40;
        return 30; // Newer properties
    }

    // Score tax delinquency
    scoreTaxDelinquency(isDelinquent, taxAmount) {
        if (isDelinquent) {
            // Higher tax amount + delinquency = more motivated
            if (taxAmount > 10000) return 100;
            if (taxAmount > 5000) return 95;
            if (taxAmount > 2000) return 90;
            return 85;
        }
        return 30; // Not delinquent
    }

    // Score ownership type
    scoreOwnershipType(lead) {
        let score = 50;
        
        if (lead.absenteeOwner) score += 20;
        if (lead.outOfStateOwner) score += 15;
        if (!lead.ownerOccupied) score += 10;
        if (lead.vacant) score += 20;
        
        return Math.min(100, score);
    }

    // Score time on market
    scoreTimeOnMarket(daysOnMarket, isListed) {
        if (!isListed) return 50;
        
        if (daysOnMarket >= 365) return 100;
        if (daysOnMarket >= 270) return 95;
        if (daysOnMarket >= 180) return 85;
        if (daysOnMarket >= 90) return 70;
        if (daysOnMarket >= 60) return 60;
        if (daysOnMarket >= 30) return 50;
        return 40;
    }

    // Score contactability
    scoreContactability(lead) {
        let score = 0;
        
        // More contact methods = easier to reach
        if (lead.phone1) score += 40;
        if (lead.phone2) score += 25;
        if (lead.phone3) score += 15;
        if (lead.email) score += 20;
        
        return Math.min(100, score);
    }

    getPriority(score) {
        if (score >= 80) return '🔥 HOT';
        if (score >= 65) return '🌡️ WARM';
        if (score >= 50) return '😐 MEDIUM';
        if (score >= 35) return '❄️ COLD';
        return '🧊 ICE';
    }

    generateInsights(lead, scores, totalScore) {
        const insights = [];

        // Distress indicators
        if (lead.distressIndicators && lead.distressIndicators.length > 0) {
            insights.push(`⚠️ DISTRESS SIGNALS: ${lead.distressIndicators.join(', ')}`);
        }

        // High motivation indicators
        if (lead.foreclosure || lead.preForeclosure) {
            insights.push(`🚨 FORECLOSURE: This is a time-sensitive opportunity - act fast!`);
        }
        
        if (lead.taxDelinquent) {
            insights.push(`💸 TAX DELINQUENT: Owner may be motivated to avoid tax sale`);
        }
        
        if (lead.vacant) {
            insights.push(`🏚️ VACANT PROPERTY: No tenant income, owner may want out`);
        }

        // Equity insights
        const equityPercent = lead.marketValue ? (lead.estimatedEquity / lead.marketValue * 100) : 0;
        if (equityPercent >= 70) {
            insights.push(`💰 HIGH EQUITY (${equityPercent.toFixed(0)}%): Great for subject-to or seller financing`);
        } else if (equityPercent < 0) {
            insights.push(`📉 UNDERWATER: Owner may be desperate, consider short sale`);
        }

        // Ownership insights
        if (lead.absenteeOwner || lead.outOfStateOwner) {
            insights.push(`🗺️ REMOTE OWNER: Likely tired of managing from distance`);
        }

        // Time on market
        if (lead.daysOnMarket > 180) {
            insights.push(`📅 STALE LISTING (${lead.daysOnMarket} days): Seller getting desperate`);
        }

        // Property age
        const age = lead.yearBuilt ? new Date().getFullYear() - lead.yearBuilt : 0;
        if (age >= 50) {
            insights.push(`🏗️ OLDER PROPERTY (${age} years): Likely needs updates - position as solution`);
        }

        // Contact strategy
        if (lead.phone1 && lead.email) {
            insights.push(`📞 MULTI-CHANNEL: Use both phone and email for outreach`);
        } else if (!lead.phone1 && !lead.email) {
            insights.push(`⚠️ LIMITED CONTACT INFO: May need additional skip tracing`);
        }

        return insights;
    }

    getRecommendedAction(lead, totalScore) {
        const actions = [];

        if (totalScore >= 80) {
            actions.push('IMMEDIATE CALL - Top priority lead');
            actions.push('Prepare cash offer or creative financing options');
            actions.push('Research comps and ARV before calling');
        } else if (totalScore >= 65) {
            actions.push('Call within 24-48 hours');
            actions.push('Build rapport and uncover pain points');
            actions.push('Follow up with value proposition email');
        } else if (totalScore >= 50) {
            actions.push('Add to regular calling rotation');
            actions.push('Send introductory letter or postcard');
            actions.push('Monitor for status changes');
        } else {
            actions.push('Add to long-term nurture campaign');
            actions.push('Check back quarterly for changes');
        }

        return actions;
    }

    calculateOfferRange(lead) {
        const marketValue = lead.marketValue || lead.assessedValue || 0;
        if (marketValue === 0) return 'Insufficient data';

        // Typical wholesaler formula: 70% ARV minus repairs
        const conservativeOffer = marketValue * 0.55; // Assuming needs work
        const aggressiveOffer = marketValue * 0.70; // If in good condition
        const midpointOffer = marketValue * 0.65;

        return {
            conservative: `$${Math.round(conservativeOffer).toLocaleString()}`,
            midpoint: `$${Math.round(midpointOffer).toLocaleString()}`,
            aggressive: `$${Math.round(aggressiveOffer).toLocaleString()}`,
            marketValue: `$${Math.round(marketValue).toLocaleString()}`
        };
    }
}

// ========================================
// AI ANALYSIS FOR SKIP TRACE LEADS
// ========================================

async function analyzeSkipTraceLeadWithAI(lead, openAiApiKey) {
    const apiUrl = "https://api.openai.com/v1/chat/completions";
    
    const requestBody = {
        model: "gpt-4",
        messages: [
            { 
                role: "system", 
                content: "You are an expert real estate wholesaler specializing in analyzing skip trace data, identifying motivated sellers, and structuring creative deals. Provide actionable cold-calling scripts and negotiation strategies."
            },
            { 
                role: "user", 
                content: `Analyze this skip trace lead and provide a complete action plan:

PROPERTY & OWNER INFO:
- Owner: ${lead.ownerName}
- Property: ${lead.address}, ${lead.city}, ${lead.state} ${lead.zip}
- Contact: ${lead.phone1 || 'N/A'} | ${lead.email || 'N/A'}

PROPERTY DETAILS:
- Type: ${lead.propertyType}
- Year Built: ${lead.yearBuilt} (${lead.yearBuilt ? new Date().getFullYear() - lead.yearBuilt : 'N/A'} years old)
- Size: ${lead.bedrooms}bd/${lead.bathrooms}ba, ${lead.squareFeet} sqft
- Lot: ${lead.lotSize} sqft

FINANCIALS:
- Market Value: $${lead.marketValue?.toLocaleString() || 'N/A'}
- Assessed Value: $${lead.assessedValue?.toLocaleString() || 'N/A'}
- Last Sale: $${lead.lastSalePrice?.toLocaleString() || 'N/A'} on ${lead.lastSaleDate || 'N/A'}
- Estimated Equity: $${lead.estimatedEquity?.toLocaleString() || 'N/A'}
- Mortgage: $${lead.estimatedMortgage?.toLocaleString() || 'N/A'}
- Tax Amount: $${lead.taxAmount?.toLocaleString() || 'N/A'}
- Liens: $${lead.lienAmount?.toLocaleString() || 'N/A'}

DISTRESS SIGNALS:
${lead.distressIndicators?.length > 0 ? lead.distressIndicators.join(', ') : 'None identified'}
- Tax Delinquent: ${lead.taxDelinquent ? 'YES ⚠️' : 'No'}
- Foreclosure: ${lead.foreclosure ? 'YES 🚨' : 'No'}
- Vacant: ${lead.vacant ? 'YES' : 'No'}
- Absentee Owner: ${lead.absenteeOwner ? 'YES' : 'No'}
- Out of State: ${lead.outOfStateOwner ? 'YES' : 'No'}
- Days on Market: ${lead.daysOnMarket || 'Not listed'}

LEAD SCORE: ${lead.likelyToSell?.toFixed(1)}/100 (${lead.priority})

SCORE BREAKDOWN:
${JSON.stringify(lead.scoreBreakdown, null, 2)}

ESTIMATED OFFER RANGE:
${JSON.stringify(lead.estimatedOfferRange, null, 2)}

Please provide:
1. **Opening Script** - First 30 seconds of the cold call
2. **Pain Point Questions** - What to ask to uncover motivation
3. **Deal Structure** - Best creative financing approach (subject-to, seller financing, lease option, etc.)
4. **Objection Handlers** - How to overcome common objections
5. **Offer Strategy** - Specific offer recommendation with reasoning
6. **Follow-up Plan** - If they don't bite immediately
7. **Red Flags** - Any concerns about this deal` 
            }
        ],
        max_tokens: 1000
    };

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openAiApiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`OpenAI API Error: ${response.status}`);
        }

        const result = await response.json();
        return result.choices[0].message.content;
    } catch (error) {
        console.error("AI Analysis failed:", error);
        return "Error analyzing lead with AI.";
    }
}

// ========================================
// MAIN APPLICATION
// ========================================

class RealToolSkipTrace {
    constructor(spreadsheetId, apiKey, openAiApiKey = null) {
        this.connector = new SkipTraceConnector({
            spreadsheetId: spreadsheetId,
            apiKey: apiKey
        });
        this.scorer = new SkipTraceLeadScorer();
        this.openAiApiKey = openAiApiKey;
        this.leads = [];
        this.scoredLeads = [];
    }

    async loadAndScoreLeads() {
        console.log("\n🔄 Loading skip trace data...\n");
        
        // Fetch leads from Google Sheets
        this.leads = await this.connector.fetchSkipTraceData();
        
        if (this.leads.length === 0) {
            console.log("❌ No leads found");
            return;
        }

        // Score all leads
        console.log(`\n📊 Scoring ${this.leads.length} leads...\n`);
        this.scoredLeads = this.scorer.scoreLeads(this.leads);
        
        console.log("✅ Lead scoring complete!\n");
        return this.scoredLeads;
    }

    showTopLeads(count = 10) {
        if (this.scoredLeads.length === 0) {
            console.log("⚠️ No leads loaded. Run loadAndScoreLeads() first.");
            return;
        }

        console.log(`\n${"=".repeat(100)}`);
        console.log(`🎯 TOP ${count} LEADS MOST LIKELY TO SELL`);
        console.log("=".repeat(100));

        this.scoredLeads.slice(0, count).forEach((lead, index) => {
            console.log(`\n${index + 1}. ${lead.ownerName}`);
            console.log(`   📍 ${lead.address}, ${lead.city}, ${lead.state} ${lead.zip}`);
            console.log(`   📊 Score: ${lead.likelyToSell.toFixed(1)}/100 | Priority: ${lead.priority}`);
            console.log(`   💰 Value: $${lead.marketValue?.toLocaleString() || 'N/A'} | Equity: $${lead.estimatedEquity?.toLocaleString() || 'N/A'}`);
            console.log(`   📞 Phone: ${lead.phone1 || 'N/A'} | Email: ${lead.email || 'N/A'}`);
            
            if (lead.distressIndicators && lead.distressIndicators.length > 0) {
                console.log(`   ⚠️  Distress: ${lead.distressIndicators.join(', ')}`);
            }
            
            console.log(`   💡 Offer Range: ${lead.estimatedOfferRange.conservative} - ${lead.estimatedOfferRange.aggressive}`);
            
            console.log(`   📋 Insights:`);
            lead.insights.forEach(insight => console.log(`      ${insight}`));
            
            console.log(`   ✅ Next Actions:`);
            lead.recommendedAction.forEach(action => console.log(`      • ${action}`));
            
            console.log(`   ---`);
        });

        console.log(`\n${"=".repeat(100)}\n`);
    }

    async analyzeTopLead() {
        if (!this.openAiApiKey) {
            console.log("⚠️ OpenAI API key not provided. Cannot perform AI analysis.");
            return;
        }

        if (this.scoredLeads.length === 0) {
            console.log("⚠️ No leads loaded. Run loadAndScoreLeads() first.");
            return;
        }

        const topLead = this.scoredLeads[0];
        
        console.log("\n🎯 SCORING CRITERIA:");
console.log("━".repeat(100));
console.log("Distress Indicators (30%): Foreclosure, tax delinquent, vacant, absentee owner");
console.log("Equity Position (20%):     High equity = creative financing | Low equity = motivated");
console.log("Property Age (10%):        Older properties likely need work");
console.log("Tax Delinquency (15%):     Unpaid taxes = urgent motivation");
console.log("Ownership Type (10%):      Absentee/out-of-state owners score higher");
console.log("Time on Market (10%):      Longer listings = more desperate sellers");
console.log("Contactability (5%):       Multiple contact methods = easier to reach");

console.log("\n📊 PRIORITY LEVELS:");
console.log("🔥 HOT (80-100):    Call immediately - highest motivation");
console.log("🌡️ WARM (65-79):    Call within 24-48 hours");
console.log("😐 MEDIUM (50-64):  Add to regular rotation");
console.log("❄️ COLD (35-49):    Long-term nurture");
console.log("🧊 ICE (0-34):      Quarterly follow-up");

console.log("\n" + "=".repeat(100));
console.log("\n✨ Ready to find your next deal! Run the commands above to get started.\n"); "=".repeat(100));
        console.log(`🤖 AI ANALYSIS FOR TOP LEAD: ${topLead.ownerName}`);
        console.log("=".repeat(100) + "\n");
        
        const analysis = await analyzeSkipTraceLeadWithAI(topLead, this.openAiApiKey);
        console.log(analysis);
        console.log("\n" + "=".repeat(100) + "\n");
    }

    getLeadsByPriority(priority) {
        return this.scoredLeads.filter(lead => lead.priority.includes(priority));
    }

    exportToCSV() {
        // Export scored leads to CSV format for easy importing
        const headers = ['Score', 'Priority', 'Owner', 'Address', 'Phone', 'Email', 'Value', 'Equity', 'Distress Indicators'];
        const rows = this.scoredLeads.map(lead => [
            lead.likelyToSell.toFixed(1),
            lead.priority,
            lead.ownerName,
            `${lead.address}, ${lead.city}, ${lead.state}`,
            lead.phone1,
            lead.email,
            lead.marketValue,
            lead.estimatedEquity,
            lead.distressIndicators?.join('; ') || ''
        ]);

        console.log('\n📄 CSV Export:\n');
        console.log(headers.join(','));
        rows.forEach(row => console.log(row.join(',')));
    }
}

// ========================================
// USAGE EXAMPLES
// ========================================

console.log("🏠 RealTool Skip Trace Lead Scoring System");
console.log("=".repeat(100));

// Example 1: Basic Setup
const mySpreadsheetId = "1hRWTt34EBEsF5-ApkfYqC7QsIKaXMm3uv_85eS4Q7aQ"; // Your Google Sheet ID
const googleApiKey = "YOUR_GOOGLE_SHEETS_API_KEY"; // Get from Google Cloud Console
const openAiApiKey = "YOUR_OPENAI_API_KEY"; // Optional for AI analysis

const realTool = new RealToolSkipTrace(mySpreadsheetId, googleApiKey, openAiApiKey);

// Example 2: Load and view top leads
console.log("\n📖 Quick Start Guide:");
console.log("1. await realTool.loadAndScoreLeads()  - Load from Google Sheets");
console.log("2. realTool.showTopLeads(20)           - Show top 20 leads");
console.log("3. await realTool.analyzeTopLead()     - Get AI analysis of #1 lead");
console.log("4. realTool.getLeadsByPriority('HOT')  - Filter by priority");
console.log("5. realTool.exportToCSV()              - Export scored list");

console.log("\n💡 Example Workflow:");
console.log("```javascript");
console.log("// Step 1: Load your skip trace list");
console.log("await realTool.loadAndScoreLeads();");
console.log("");
console.log("// Step 2: See your hottest leads");
console.log("realTool.showTopLeads(10);");
console.log("");
console.log("// Step 3: Get AI-powered calling strategy");
console.log("await realTool.analyzeTopLead();");
console.log("");
console.log("// Step 4: Filter for calling campaign");
console.log("const hotLeads = realTool.getLeadsByPriority('HOT');");
console.log("console.log(`Found ${hotLeads.length} hot leads to call today!`);");
console.log("```");

console.log("\n" +
