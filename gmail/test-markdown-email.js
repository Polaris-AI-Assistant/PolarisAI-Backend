/**
 * Test script to verify Markdown to HTML conversion in emails
 */

const MarkdownIt = require('markdown-it');

// Sample Markdown content (similar to what the agent generates)
const markdownContent = `# Latest Developments in AI (October 2023)

## Key Highlights

### 1. AI Innovations and Technologies
- **Thermodynamic Computers**: A new type of computing technology has emerged that can mimic AI neural networks while using significantly less energy.

### 2. Industry Trends
- **Generative AI**: The focus continues to be on generative AI technologies, including large language models.
- **AI in Gaming**: Microsoft's new gaming CEO has emphasized a commitment to quality.

### 3. Market Dynamics
- **Investment in AI**: Venture capital interest in AI remains strong, with firms like Peak XV raising substantial funds.

## Conclusion
The AI landscape is rapidly evolving, with significant advancements in technology, investment, and user engagement.

---

**Sources:**
1. AI News & Artificial Intelligence | TechCrunch - https://techcrunch.com/category/artificial-intelligence/
2. Reddit - The heart of the internet - https://www.reddit.com/r/artificial/


Best regards,
Bhumika Yadav`;

console.log('=== ORIGINAL MARKDOWN ===');
console.log(markdownContent);
console.log('\n\n=== CONVERTED HTML ===');
const md = new MarkdownIt();
const htmlContent = md.render(markdownContent);
console.log(htmlContent);

// Test Markdown detection
const hasMarkdownSyntax = markdownContent.includes('##') || 
                          markdownContent.includes('**') || 
                          markdownContent.includes('###') || 
                          markdownContent.includes('- **') ||
                          markdownContent.includes('\n- ') || 
                          markdownContent.includes('\n* ');

console.log('\n\n=== MARKDOWN DETECTION ===');
console.log('Has Markdown syntax:', hasMarkdownSyntax);
