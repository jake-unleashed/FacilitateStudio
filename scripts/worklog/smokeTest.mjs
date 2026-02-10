#!/usr/bin/env node
/**
 * Smoke Test for Worklog System
 * 
 * Tests all components of the worklog system to ensure they work correctly.
 */

import { appendEvent, getCurrentBranch, getEvents, readEvents } from './logger.mjs';
import { createBaseEvent, EventTypes, SessionStatus } from './schema.mjs';
import { generateCurrentFeatureDigest } from './generateDigest.mjs';
import crypto from 'node:crypto';

const testResults = [];

function logTest(name, passed, message = '') {
  testResults.push({ name, passed, message });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}${message ? `: ${message}` : ''}`);
}

async function testGetCurrentBranch() {
  try {
    const branch = await getCurrentBranch();
    logTest('Get current branch', branch && branch !== 'unknown', branch);
    return branch;
  } catch (error) {
    logTest('Get current branch', false, error.message);
    return null;
  }
}

async function testSessionStartEvent(branch) {
  try {
    const event = {
      ...createBaseEvent(EventTypes.SESSION_START, branch),
      conversationId: 'test-conv-' + Date.now(),
      generationId: 'test-gen-' + Date.now(),
      intentSummary: 'Test smoke test worklog system functionality',
      promptHash: crypto.randomBytes(6).toString('hex'),
    };
    
    await appendEvent(event);
    logTest('Append session_start event', true);
    return event;
  } catch (error) {
    logTest('Append session_start event', false, error.message);
    return null;
  }
}

async function testSessionEndEvent(branch, sessionStartEvent) {
  try {
    const event = {
      ...createBaseEvent(EventTypes.SESSION_END, branch),
      conversationId: sessionStartEvent.conversationId,
      generationId: sessionStartEvent.generationId,
      status: SessionStatus.COMPLETED,
      durationMs: 5000,
      insights: ['Successfully tested worklog system', 'All components working correctly'],
    };
    
    await appendEvent(event);
    logTest('Append session_end event', true);
    return event;
  } catch (error) {
    logTest('Append session_end event', false, error.message);
    return null;
  }
}

async function testCommitEvent(branch) {
  try {
    const event = {
      ...createBaseEvent(EventTypes.COMMIT, branch),
      hash: crypto.randomBytes(20).toString('hex'),
      subject: 'Test commit for worklog smoke test',
      filesChanged: 3,
      insertions: 42,
      deletions: 7,
    };
    
    await appendEvent(event);
    logTest('Append commit event', true);
    return event;
  } catch (error) {
    logTest('Append commit event', false, error.message);
    return null;
  }
}

async function testReadEvents() {
  try {
    const events = await readEvents();
    logTest('Read events from log', events.length > 0, `${events.length} events found`);
    return events;
  } catch (error) {
    logTest('Read events from log', false, error.message);
    return [];
  }
}

async function testFilterEvents(branch) {
  try {
    const events = await getEvents({ branch });
    logTest('Filter events by branch', events.length > 0, `${events.length} events for ${branch}`);
    return events;
  } catch (error) {
    logTest('Filter events by branch', false, error.message);
    return [];
  }
}

async function testGenerateDigest() {
  try {
    const digestPath = await generateCurrentFeatureDigest({
      typecheck: '✓ passed',
      lint: '✓ passed',
      tests: '✓ passed (smoke test)',
    });
    
    logTest('Generate feature digest', digestPath !== null, digestPath);
    return digestPath;
  } catch (error) {
    logTest('Generate feature digest', false, error.message);
    return null;
  }
}

async function main() {
  console.log('\n🧪 Worklog System Smoke Test\n');
  console.log('=' .repeat(50));
  console.log();
  
  // Test 1: Get current branch
  const branch = await testGetCurrentBranch();
  if (!branch) {
    console.log('\n❌ Cannot continue without valid git branch');
    process.exit(1);
  }
  
  console.log();
  
  // Test 2: Create test events
  const sessionStart = await testSessionStartEvent(branch);
  const sessionEnd = sessionStart ? await testSessionEndEvent(branch, sessionStart) : null;
  const commit = await testCommitEvent(branch);
  
  console.log();
  
  // Test 3: Read events
  const allEvents = await testReadEvents();
  const branchEvents = await testFilterEvents(branch);
  
  console.log();
  
  // Test 4: Generate digest
  const digestPath = await testGenerateDigest();
  
  console.log();
  console.log('=' .repeat(50));
  console.log();
  
  // Summary
  const passed = testResults.filter(r => r.passed).length;
  const total = testResults.length;
  
  console.log(`📊 Results: ${passed}/${total} tests passed\n`);
  
  if (passed === total) {
    console.log('✅ All tests passed! Worklog system is working correctly.\n');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Check the output above for details.\n');
    process.exit(1);
  }
}

main();
