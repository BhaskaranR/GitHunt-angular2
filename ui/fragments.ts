import { createFragment } from 'apollo-client';

import gql from 'graphql-tag';

export const scoreInfoFragment = createFragment(gql`
  fragment scoreInfo on Entry {
    score
  }
`);
