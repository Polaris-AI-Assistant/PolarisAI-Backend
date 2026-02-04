/**
 * Test Microsoft Artifact Memory Integration
 * 
 * Run: node testMicrosoftArtifacts.js
 */

require('dotenv').config();

const {
    extractAndStoreArtifact,
    getArtifacts,
    formatArtifactsForPrompt,
    clearArtifacts,
    ARTIFACT_TYPES
} = require('./utils/artifactMemory');

const TEST_CONVERSATION_ID = 'test-microsoft-artifacts-' + Date.now();

async function testMicrosoftArtifacts() {
    console.log('\n🧪 Testing Microsoft Artifact Memory Integration\n');
    console.log('='.repeat(60));
    console.log(`📝 Test Conversation ID: ${TEST_CONVERSATION_ID}\n`);

    // Test 1: Outlook Email Artifact
    console.log('\n📧 Test 1: Outlook Email Artifact');
    console.log('-'.repeat(40));
    
    const emailResult = {
        success: true,
        message: 'Email sent successfully',
        tools_used: [{ name: 'microsoft_sendEmail', arguments: { to: 'test@example.com', subject: 'Project Update' } }],
        raw_results: [{
            success: true,
            message: 'Email sent successfully',
            to: 'test@example.com',
            subject: 'Project Update'
        }]
    };

    const emailArtifact = await extractAndStoreArtifact(
        TEST_CONVERSATION_ID,
        'microsoft',
        'microsoft_sendEmail',
        emailResult
    );
    
    if (emailArtifact) {
        console.log('✅ Email artifact stored:', emailArtifact);
    } else {
        console.log('❌ Failed to store email artifact');
    }

    // Test 2: Microsoft Calendar Event Artifact
    console.log('\n📅 Test 2: Microsoft Calendar Event Artifact');
    console.log('-'.repeat(40));
    
    const calendarResult = {
        success: true,
        tools_used: [{ name: 'microsoft_createCalendarEvent' }],
        raw_results: [{
            success: true,
            id: 'event-123-abc',
            subject: 'Team Standup',
            start: { dateTime: '2026-01-21T10:00:00' },
            end: { dateTime: '2026-01-21T10:30:00' },
            onlineMeeting: { joinUrl: 'https://teams.microsoft.com/meet/xyz' }
        }]
    };

    const calendarArtifact = await extractAndStoreArtifact(
        TEST_CONVERSATION_ID,
        'microsoft',
        'microsoft_createCalendarEvent',
        calendarResult
    );
    
    if (calendarArtifact) {
        console.log('✅ Calendar artifact stored:', calendarArtifact);
    } else {
        console.log('❌ Failed to store calendar artifact');
    }

    // Test 3: OneDrive File Artifact
    console.log('\n📁 Test 3: OneDrive File Artifact');
    console.log('-'.repeat(40));
    
    const fileResult = {
        success: true,
        tools_used: [{ name: 'microsoft_uploadFile' }],
        raw_results: [{
            success: true,
            id: 'file-456-def',
            name: 'report.docx',
            webUrl: 'https://onedrive.live.com/edit/report.docx',
            size: 25600
        }]
    };

    const fileArtifact = await extractAndStoreArtifact(
        TEST_CONVERSATION_ID,
        'microsoft',
        'microsoft_uploadFile',
        fileResult
    );
    
    if (fileArtifact) {
        console.log('✅ OneDrive file artifact stored:', fileArtifact);
    } else {
        console.log('❌ Failed to store OneDrive artifact');
    }

    // Test 4: Retrieve all artifacts
    console.log('\n📋 Test 4: Retrieve All Stored Artifacts');
    console.log('-'.repeat(40));
    
    const allArtifacts = await getArtifacts(TEST_CONVERSATION_ID);
    console.log(`Found ${allArtifacts?.length || 0} artifacts:`);
    allArtifacts?.forEach((a, i) => {
        console.log(`  ${i + 1}. [${a.type}] ${a.title} (ID: ${a.id})`);
    });

    // Test 5: Format for AI prompt
    console.log('\n🤖 Test 5: Format Artifacts for AI Prompt');
    console.log('-'.repeat(40));
    
    const promptContext = await formatArtifactsForPrompt(TEST_CONVERSATION_ID);
    console.log('Prompt context:\n');
    console.log(promptContext || '(empty)');

    // Cleanup
    console.log('\n🧹 Cleanup: Clearing test artifacts...');
    await clearArtifacts(TEST_CONVERSATION_ID);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Microsoft Artifact Memory Tests Complete!\n');
}

// Run tests
testMicrosoftArtifacts().catch(console.error);
