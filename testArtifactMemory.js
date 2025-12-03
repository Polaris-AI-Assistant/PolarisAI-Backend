/**
 * Artifact Memory Test Suite
 * 
 * Tests the artifact memory system for storing and retrieving artifacts.
 * Run with: node testArtifactMemory.js
 */

const { connectRedis, testRedisConnection } = require('./utils/redisClient');
const {
    addArtifact,
    extractAndStoreArtifact,
    getArtifacts,
    getLastArtifact,
    getArtifactByType,
    getLastArtifactByType,
    listArtifacts,
    clearArtifacts,
    formatArtifactsForPrompt,
    ARTIFACT_TYPES
} = require('./utils/artifactMemory');
const {
    containsArtifactReference,
    detectArtifactType,
    resolveArtifactFromQuery,
    buildArtifactContext
} = require('./middleware/artifactContext');

const TEST_CONVERSATION_ID = 'test-conversation-' + Date.now();

async function runTests() {
    console.log('🧪 Starting Artifact Memory Tests\n');
    console.log(`📋 Test Conversation ID: ${TEST_CONVERSATION_ID}\n`);

    let passed = 0;
    let failed = 0;

    // Test 1: Redis Connection
    console.log('Test 1: Redis Connection');
    try {
        const result = await testRedisConnection();
        if (result.success) {
            console.log('✅ Redis connection successful');
            passed++;
        } else {
            console.log('❌ Redis connection failed:', result.error);
            failed++;
        }
    } catch (error) {
        console.log('❌ Redis connection error:', error.message);
        failed++;
    }
    console.log('');

    // Test 2: Add Artifact
    console.log('Test 2: Add Artifact (Form)');
    try {
        const artifact = await addArtifact(TEST_CONVERSATION_ID, {
            id: 'form-123',
            type: ARTIFACT_TYPES.FORM,
            title: 'Customer Feedback Form',
            data: { responderUri: 'https://forms.google.com/form-123' }
        });
        
        if (artifact && artifact.id === 'form-123') {
            console.log('✅ Form artifact added successfully');
            console.log('   ID:', artifact.id);
            console.log('   Type:', artifact.type);
            console.log('   Title:', artifact.title);
            passed++;
        } else {
            console.log('❌ Failed to add form artifact');
            failed++;
        }
    } catch (error) {
        console.log('❌ Add artifact error:', error.message);
        failed++;
    }
    console.log('');

    // Test 3: Add another artifact (Doc)
    console.log('Test 3: Add Artifact (Document)');
    try {
        const artifact = await addArtifact(TEST_CONVERSATION_ID, {
            id: 'doc-456',
            type: ARTIFACT_TYPES.DOC,
            title: 'Meeting Notes',
            data: { url: 'https://docs.google.com/document/d/doc-456' }
        });
        
        if (artifact && artifact.id === 'doc-456') {
            console.log('✅ Document artifact added successfully');
            passed++;
        } else {
            console.log('❌ Failed to add document artifact');
            failed++;
        }
    } catch (error) {
        console.log('❌ Add artifact error:', error.message);
        failed++;
    }
    console.log('');

    // Test 4: Get all artifacts
    console.log('Test 4: Get All Artifacts');
    try {
        const artifacts = await getArtifacts(TEST_CONVERSATION_ID);
        
        if (artifacts.length === 2) {
            console.log('✅ Retrieved all artifacts correctly');
            console.log('   Count:', artifacts.length);
            passed++;
        } else {
            console.log('❌ Expected 2 artifacts, got:', artifacts.length);
            failed++;
        }
    } catch (error) {
        console.log('❌ Get artifacts error:', error.message);
        failed++;
    }
    console.log('');

    // Test 5: Get last artifact
    console.log('Test 5: Get Last Artifact');
    try {
        const artifact = await getLastArtifact(TEST_CONVERSATION_ID);
        
        if (artifact && artifact.id === 'doc-456') {
            console.log('✅ Got correct last artifact');
            console.log('   ID:', artifact.id);
            console.log('   Type:', artifact.type);
            passed++;
        } else {
            console.log('❌ Got wrong artifact:', artifact?.id);
            failed++;
        }
    } catch (error) {
        console.log('❌ Get last artifact error:', error.message);
        failed++;
    }
    console.log('');

    // Test 6: Get artifact by type
    console.log('Test 6: Get Artifact By Type (Form)');
    try {
        const artifacts = await getArtifactByType(TEST_CONVERSATION_ID, ARTIFACT_TYPES.FORM);
        
        if (artifacts.length === 1 && artifacts[0].id === 'form-123') {
            console.log('✅ Got correct form artifact');
            passed++;
        } else {
            console.log('❌ Wrong form artifacts:', artifacts.length);
            failed++;
        }
    } catch (error) {
        console.log('❌ Get by type error:', error.message);
        failed++;
    }
    console.log('');

    // Test 7: List artifacts (summary)
    console.log('Test 7: List Artifacts (Summary)');
    try {
        const list = await listArtifacts(TEST_CONVERSATION_ID);
        
        if (list.length === 2 && list[0].createdAtFormatted) {
            console.log('✅ Listed artifacts with proper format');
            list.forEach(a => console.log(`   - ${a.type}: ${a.title} (${a.id})`));
            passed++;
        } else {
            console.log('❌ List format incorrect');
            failed++;
        }
    } catch (error) {
        console.log('❌ List artifacts error:', error.message);
        failed++;
    }
    console.log('');

    // Test 8: Format for prompt
    console.log('Test 8: Format Artifacts For Prompt');
    try {
        const prompt = await formatArtifactsForPrompt(TEST_CONVERSATION_ID);
        
        if (prompt.includes('Form') && prompt.includes('Document') && prompt.includes('formId=')) {
            console.log('✅ Prompt formatted correctly');
            console.log('   Preview:', prompt.substring(0, 100) + '...');
            passed++;
        } else {
            console.log('❌ Prompt format incorrect');
            console.log('   Got:', prompt);
            failed++;
        }
    } catch (error) {
        console.log('❌ Format for prompt error:', error.message);
        failed++;
    }
    console.log('');

    // Test 9: Detect artifact reference
    console.log('Test 9: Detect Artifact References');
    try {
        const tests = [
            { query: 'add a field to it', expected: true },
            { query: 'update the form', expected: true },
            { query: 'show me my calendar', expected: false },
            { query: 'modify that document', expected: true },
            { query: 'continue', expected: true }
        ];
        
        let subPassed = 0;
        for (const t of tests) {
            const result = containsArtifactReference(t.query);
            if (result === t.expected) {
                subPassed++;
            } else {
                console.log(`   ❌ "${t.query}" expected ${t.expected}, got ${result}`);
            }
        }
        
        if (subPassed === tests.length) {
            console.log('✅ All reference detection tests passed');
            passed++;
        } else {
            console.log(`❌ ${tests.length - subPassed} detection tests failed`);
            failed++;
        }
    } catch (error) {
        console.log('❌ Reference detection error:', error.message);
        failed++;
    }
    console.log('');

    // Test 10: Detect artifact type from query
    console.log('Test 10: Detect Artifact Type');
    try {
        const tests = [
            { query: 'update the form', expected: 'form' },
            { query: 'add to the document', expected: 'doc' },
            { query: 'modify the spreadsheet', expected: 'sheet' },
            { query: 'send the email', expected: 'email' }
        ];
        
        let subPassed = 0;
        for (const t of tests) {
            const result = detectArtifactType(t.query);
            if (result === t.expected) {
                subPassed++;
            } else {
                console.log(`   ❌ "${t.query}" expected ${t.expected}, got ${result}`);
            }
        }
        
        if (subPassed === tests.length) {
            console.log('✅ All type detection tests passed');
            passed++;
        } else {
            console.log(`❌ ${tests.length - subPassed} type detection tests failed`);
            failed++;
        }
    } catch (error) {
        console.log('❌ Type detection error:', error.message);
        failed++;
    }
    console.log('');

    // Test 11: Resolve artifact from query
    console.log('Test 11: Resolve Artifact From Query');
    try {
        const resolved = await resolveArtifactFromQuery(TEST_CONVERSATION_ID, 'add a field to the form');
        
        if (resolved && resolved.artifact.id === 'form-123') {
            console.log('✅ Resolved artifact correctly');
            console.log('   Resolved to:', resolved.artifact.title);
            passed++;
        } else {
            console.log('❌ Failed to resolve artifact');
            failed++;
        }
    } catch (error) {
        console.log('❌ Resolve artifact error:', error.message);
        failed++;
    }
    console.log('');

    // Test 12: Build artifact context
    console.log('Test 12: Build Artifact Context');
    try {
        const context = await buildArtifactContext(TEST_CONVERSATION_ID, 'update it');
        
        if (context.hasArtifactReference && context.resolvedArtifact) {
            console.log('✅ Built artifact context correctly');
            console.log('   Has reference:', context.hasArtifactReference);
            console.log('   Resolved to:', context.resolvedArtifact.title);
            console.log('   Total artifacts:', context.allArtifacts.length);
            passed++;
        } else {
            console.log('❌ Context build failed');
            failed++;
        }
    } catch (error) {
        console.log('❌ Build context error:', error.message);
        failed++;
    }
    console.log('');

    // Test 13: Extract and store from tool result
    console.log('Test 13: Extract And Store Artifact');
    try {
        const toolResult = {
            success: true,
            eventId: 'event-789',
            event: {
                summary: 'Team Meeting',
                htmlLink: 'https://calendar.google.com/event/789',
                start: { dateTime: '2024-12-04T10:00:00Z' }
            }
        };
        
        const artifact = await extractAndStoreArtifact(
            TEST_CONVERSATION_ID,
            'calendar',
            'createEvent',
            toolResult
        );
        
        if (artifact && artifact.type === 'event') {
            console.log('✅ Extracted and stored calendar event');
            console.log('   ID:', artifact.id);
            console.log('   Title:', artifact.title);
            passed++;
        } else {
            console.log('❌ Failed to extract event artifact');
            failed++;
        }
    } catch (error) {
        console.log('❌ Extract artifact error:', error.message);
        failed++;
    }
    console.log('');

    // Test 14: Clear artifacts
    console.log('Test 14: Clear Artifacts');
    try {
        await clearArtifacts(TEST_CONVERSATION_ID);
        const artifacts = await getArtifacts(TEST_CONVERSATION_ID);
        
        if (artifacts.length === 0) {
            console.log('✅ Artifacts cleared successfully');
            passed++;
        } else {
            console.log('❌ Artifacts not cleared, still have:', artifacts.length);
            failed++;
        }
    } catch (error) {
        console.log('❌ Clear artifacts error:', error.message);
        failed++;
    }
    console.log('');

    // Summary
    console.log('═══════════════════════════════════════');
    console.log('📊 Test Summary');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Total:  ${passed + failed}`);
    console.log('');
    
    if (failed === 0) {
        console.log('🎉 All tests passed! Artifact Memory is ready.');
    } else {
        console.log('⚠️  Some tests failed. Please review the errors above.');
    }

    process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
    console.error('Test suite error:', error);
    process.exit(1);
});
