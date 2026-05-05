import React from 'react';

if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_WHY_DID_YOU_RENDER === 'true') {
  import('@welldone-software/why-did-you-render').then(({ default: wdyr }) => {
    wdyr(React, {
      include: [/^.*/],
      trackAllPureComponents: true,
      trackHooks: true
    });
  });
}

