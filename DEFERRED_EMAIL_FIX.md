# Deferred Email Generation Fix

## Problem

When creating a document and sharing it via email in a sequential multi-agent task, the email was being sent with placeholder content instead of the actual document details.

### Example of the Issue:

```
User: "Create a doc about machine learning and share it with Bhumika Yadav"

Step 1: Docs agent creates document ✅
  - Document ID: 1IFLkFx_p7xDHnvkS0OXhga7bXRuwY-pTz12rKSzpBCk
  - URL: https://docs.google.com/document/d/...

Step 2: Gmail agent sends email ❌
  - Subject: "⏳ Will be generated after previous action completes"
  - Body: "Email content will be generated with actual details from the previous action."
  
❌ WRONG: Email sent with placeholder content!
```

## Root Cause

The system has two execution flows:

1. **Chain Flow** (action chains with confirmations)
   - Email enhancement happens AFTER first action completes
   - Works correctly ✅

2. **Sequential Multi-Agent Flow** (multiple agents in sequence)
   - Email enhancement was NOT happening before execution
   - Used placeholder params directly ❌

The issue was in `mainAgent.js` around line 447:

```javascript
// If this is the confirmed agent, force the specific tool execution
if (currentAgentName === agentName) {
  agentOptions.forceToolExecution = {
    toolName,
    params  // ❌ These are the PLACEHOLDER params!
  };
}
```

The `params` contained the deferred placeholder content, and there was no check to regenerate the email with actual document details before execution.

## Solution

Added a check for deferred emails in the sequential multi-agent flow. Before executing the email agent, the system now:

1. Checks if the email has `_deferredGeneration` flag
2. Finds the previous agent's result (e.g., docs agent)
3. Extracts the artifact (document, form, etc.)
4. Calls `enhanceEmailWithPreviousResult` to regenerate the email
5. Uses the enhanced params instead of placeholder params

### Code Changes

**File Modified**: `PolarisAI-Backend/mainAgent/mainAgent.js` (around line 447)

```javascript
// If this is the confirmed agent, force the specific tool execution
if (currentAgentName === agentName) {
  // ✅ CRITICAL: Check if this is a deferred email that needs regeneration
  if ((toolName === 'sendEmail' || toolName === 'microsoft_sendEmail') && params._deferredGeneration) {
    console.log(`[MainAgent] 🔄 Deferred email detected - regenerating with actual details before execution`);
    
    // Find the previous agent's result to extract artifact details
    const previousAgentNames = originalAnalysis.agents.slice(0, originalAnalysis.agents.indexOf(currentAgentName));
    let previousArtifact = null;
    let previousResult = null;
    
    // Get the most recent artifact from previous agents
    for (const prevAgentName of previousAgentNames.reverse()) {
      if (results[prevAgentName] && storedArtifacts.length > 0) {
        previousArtifact = storedArtifacts[storedArtifacts.length - 1];
        previousResult = results[prevAgentName];
        break;
      }
    }
    
    if (previousArtifact || previousResult) {
      console.log(`[MainAgent] 📧 Enhancing email with previous result`);
      
      // Create a mock email action to pass to enhanceEmailWithPreviousResult
      const emailAction = {
        agentName: currentAgentName,
        toolName: toolName,
        params: params
      };
      
      const completedResult = {
        agentName: previousAgentNames[previousAgentNames.length - 1],
        toolName: null,
        result: previousResult,
        artifact: previousArtifact
      };
      
      const enhancedEmailAction = await this.enhanceEmailWithPreviousResult(emailAction, completedResult, userId);
      
      // Use the enhanced params instead of the placeholder params
      agentOptions.forceToolExecution = {
        toolName,
        params: enhancedEmailAction.params
      };
      
      console.log(`[MainAgent] ✅ Email enhanced with actual details`);
    }
  } else {
    // Normal forced execution (not a deferred email)
    agentOptions.forceToolExecution = {
      toolName,
      params
    };
  }
}
```

## How It Works Now

### Flow Diagram

```
User: "Create a doc about machine learning and share it with Bhumika Yadav"
    ↓
MainAgent analyzes query:
  - Agents: [docs, gmail]
  - Sequential: true
  - Dependencies: gmail depends on docs
    ↓
Confirmation phase:
  - Docs: Execute immediately
  - Gmail: Deferred (placeholder params)
    ↓
User confirms email
    ↓
Sequential execution starts:
    ↓
Step 1: Execute docs agent
  - Creates document ✅
  - Stores artifact ✅
    ↓
Step 2: Before executing gmail agent
  - Check: Is this a deferred email? YES
  - Find previous artifact (document)
  - Call enhanceEmailWithPreviousResult()
  - Regenerate email with actual details ✅
    ↓
Step 3: Execute gmail agent
  - Uses ENHANCED params (not placeholder)
  - Sends email with actual document link ✅
  - Subject: "Document Shared: Basics of Machine Learning"
  - Body: "Hi Bhumika, I'm sharing a document..."
          [Document Link]
```

## Expected Logs

```
[MainAgent] 🔄 Sequential multi-agent task detected
[MainAgent]   Agents: docs, gmail
[MainAgent] 🔄 Executing docs sequentially with query: "create a document..."
[DocsAgent] ✅ Document created: 1IFLkFx_p7xDHnvkS0OXhga7bXRuwY-pTz12rKSzpBCk
[MainAgent] ✅ Artifact stored: doc - Basics of Machine Learning
[MainAgent] 🔄 Executing gmail sequentially with query: "send email..."
[MainAgent] 🔄 Deferred email detected - regenerating with actual details before execution
[MainAgent] 📧 Enhancing email with previous result from docs
[MainAgent] 🔄 Email was deferred - REGENERATING completely with actual details
[MainAgent] 📧 Regenerating document email with details: {...}
[MainAgent] ✅ Email regenerated: {...}
[MainAgent] ✅ Email enhanced with actual details: {subject: "...", bodyPreview: "..."}
[GmailAgent] 📧 Sending email to: bhumika15696@gmail.com
[GmailAgent] ✅ Email sent successfully
```

## Testing

### Test Case 1: Document + Email

**Query**: "Create a doc about machine learning and share it with Bhumika Yadav"

**Expected**:
- ✅ Document created with ML content
- ✅ Email sent to bhumika15696@gmail.com (from memory)
- ✅ Email subject: "Document Shared: Basics of Machine Learning" (or similar)
- ✅ Email body includes document link
- ✅ Email body has proper greeting and sign-off

### Test Case 2: Form + Email

**Query**: "Create a feedback form and send it to john@example.com"

**Expected**:
- ✅ Form created
- ✅ Email sent with form link
- ✅ Email has proper content (not placeholder)

### Test Case 3: Multiple Documents + Email

**Query**: "Create two docs about Python and Java, then email them to sarah@example.com"

**Expected**:
- ✅ Both documents created
- ✅ Email includes links to both documents
- ✅ Email has proper content

## What Changed

### Before:
```javascript
// Sequential multi-agent flow
if (currentAgentName === agentName) {
  agentOptions.forceToolExecution = {
    toolName,
    params  // ❌ Placeholder params used directly
  };
}
```

### After:
```javascript
// Sequential multi-agent flow
if (currentAgentName === agentName) {
  // Check if deferred email
  if (params._deferredGeneration) {
    // Find previous artifact
    // Regenerate email with actual details ✅
    // Use enhanced params
  } else {
    // Normal execution
  }
}
```

## Benefits

1. ✅ Emails now contain actual document/form links
2. ✅ Proper email subjects and bodies
3. ✅ Better user experience
4. ✅ Consistent behavior across both execution flows (chain and sequential)
5. ✅ No more placeholder content in sent emails

## Related Fixes

This fix works in conjunction with:
- Email context extraction (already implemented)
- Gmail agent system prompt update (already implemented)
- Email enhancement logic (already implemented)

All components now work together to ensure emails are sent with correct addresses and proper content.

---

**Status**: ✅ FIXED and ready for testing!
