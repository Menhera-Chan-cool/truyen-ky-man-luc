"use client";
// Use one import for reading/precache, and keep its timing entry even in a long-lived tab.
export const loadNovelLookup=()=>{
  if(typeof window!=='undefined'&&typeof performance.setResourceTimingBufferSize==='function')performance.setResourceTimingBufferSize(Math.max(2000,performance.getEntriesByType('resource').length+128));
  return import('../components/NovelLookup');
};
