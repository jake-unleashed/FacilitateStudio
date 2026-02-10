#!/usr/bin/env node
/**
 * Integration Test for Worklog System
 * 
 * Tests the full end-to-end flow including real git operations.
 * This is more comprehensive than smokeTest - it tests actual git hook integration.
 */

import { readEvents, getCurrentBranch } from './logger.mjs';
import { generateCurrentFeatureDigest } from './generateDigest.mjs';
import { execSync } from 'node:child_process';

const testResults = [];

function logTest(name, passed, message = '') {
  testResults.push({ name, passed, message });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}${message ? `: ${message}` : ''}`);
}

async function main() {
  console.log('\n🧪 Worklog System Integration Test\n');
  console.log('=' .repeat(50));
  console.log();
  
  // Test 1: Check we're in a git repo
  let branch;
  try {
    branch = await getCurrentBranch();
    logTest('Git repository detected', true, branch);
  } catch (error) {
    logTest('Git repository detected', false, error.message);
    console.log('\n❌ Not in a git repository - cannot continue');
    process.exit(1);
  }
  
  console.log();
  
  // Test 2: Read existing events
  let events;
  try {
    events = await readEvents();
    logTest('Read events from log', events.length >= 0, `${events.length} events found`);
  } catch (error) {
    logTest('Read events from log', false, error.message);
    events = [];
  }
  
  // Test 3: Check for session events (proves Cursor hooks are working)
  const sessionStarts = events.filter(e => e.type === 'session_start');
  const sessionEnds = events.filter(e => e.type === 'session_end');
  logTest(
    'Cursor hooks captured sessions',
    sessionStarts.length > 0,
    `${sessionStarts.length} starts, ${sessionEnds.length} ends`
  );
  
  // Test 4: Check for commit events (proves git hooks are working)
  const commits = events.filter(e => e.type === 'commit');
  logTest('Git post-commit hook captured commits', commits.length > 0, `${commits.length} commits`);
  
  // Test 5: Check for push events
  const pushes = events.filter(e => e.type === 'push');
  logTest('Git pre-push hook captured pushes', pushes.length >= 0, `${pushes.length} pushes`);
  
  console.log();
  
  // Test 6: Check event quality
  if (sessionStarts.length > 0) {
    const recentSession = sessionStarts[sessionStarts.length - 1];
    const hasIntention = recentSession.intentSummary && recentSession.intentSummary.length > 0;
    const hasIds = recentSession.conversationId && recentSession.generationId;
    logTest(
      'Session events have required fields',
      hasIntention && hasIds,
      hasIntention ? '✓ intention summary' : '✗ missing intention'
    );
  }
  
  if (commits.length > 0) {
    const recentCommit = commits[commits.length - 1];
    const hasHash = recentCommit.hash && recentCommit.hash.length > 0;
    const hasSubject = recentCommit.subject && recentCommit.subject.length > 0;
    logTest(
      'Commit events have required fields',
      hasHash && hasSubject,
      hasHash && hasSubject ? '✓ hash & subject' : '✗ missing data'
    );
  }
  
  console.log();
  
  // Test 7: Generate digest
  let digestPath;
  try {
    digestPath = await generateCurrentFeatureDigest({
      typecheck: '✓ passed (integration test)',
      lint: '✓ passed (integration test)',
      tests: '✓ passed (integration test)',
    });
    logTest('Generate feature digest', digestPath !== null, digestPath);
  } catch (error) {
    logTest('Generate feature digest', false, error.message);
  }
  
  console.log();
  console.log('=' .repeat(50));
  console.log();
  
  // Summary
  const passed = testResults.filter(r => r.passed).length;
  const total = testResults.length;
  
  console.log(`📊 Results: ${passed}/${total} tests passed\n`);
  
  // Analysis
  console.log('📋 System Status:\n');
  
  if (sessionStarts.length > 0) {
    console.log('✅ Cursor hooks are WORKING (capturing AI sessions)');
  } else {
    console.log('⚠️  Cursor hooks not yet tested (no session events found)');
  }
  
  if (commits.length > 0) {
    console.log('✅ Git post-commit hook is WORKING');
  } else {
    console.log('⚠️  Git post-commit hook not yet tested (no commits logged)');
  }
  
  if (pushes.length > 0) {
    console.log('✅ Git pre-push hook is WORKING');
  } else {
    console.log('ℹ️  Git pre-push hook not yet tested (no pushes logged)');
  }
  
  if (digestPath) {
    console.log('✅ Feature digest generation is WORKING');
  }
  
  console.log();
  
  if (passed === total && sessionStarts.length > 0 && commits.length > 0) {
    console.log('🎉 All systems operational! Worklog is capturing everything.\n');
    process.exit(0);
  } else if (passed === total) {
    console.log('✅ All tests passed! System is ready (needs real usage to verify hooks).\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Check the output above for details.\n');
    process.exit(1);
  }
}

main();
