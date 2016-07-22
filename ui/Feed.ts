import {
  Component,
  Input,
  Output,
  EventEmitter
} from '@angular/core';

import {
  RouteParams,
  RouterLink
} from '@angular/router-deprecated';

import {
  Apollo
} from 'angular2-apollo';

import gql from 'graphql-tag';

import {
  ApolloQueryResult,
} from 'apollo-client';

import {
  client
} from './client.ts';

import {
  Loading
} from './Loading.ts';

import {
  RepoInfo
} from './RepoInfo.ts';

import {
  scoreInfoFragment
} from './fragments.ts';

@Component({
  selector: 'vote-buttons',
  template: `
    <span>
      <button
        class="btn btn-score"
        [ngClass]="{active: vote.vote_value === 1}"
        (click)="voteUp()">
        <span class="glyphicon glyphicon-triangle-top" aria-hidden="true"></span>
      </button>
      <div class="vote-score">{{ score }}</div>
      <button
        class="btn btn-score"
        [ngClass]="{active: vote.vote_value === -1}"
        (click)="voteDown()">
        <span class="glyphicon glyphicon-triangle-bottom" aria-hidden="true"></span>
      </button>
      &nbsp;
    </span>
  `
})
class VoteButtons {
  @Input() canVote: boolean;
  @Input() score: number;
  @Input() vote: any;
  @Output() onVote: EventEmitter<string> = new EventEmitter();

  public voteUp(): void {
    this.submitVote('UP');
  }

  public voteDown(): void {
    this.submitVote('DOWN');
  }

  private submitVote(type: string): void {
    if (this.canVote === true) {
      const voteValue = {
        UP: 1,
        DOWN: -1,
      }[type];

      this.onVote.emit(this.vote.vote_value === voteValue ? 'CANCEL' : type);
    }
  }
}

interface onVoteEvent {
  repoFullName: string;
  type: string;
}

@Component({
  selector: 'feed-entry',
  directives: [
    VoteButtons,
    RepoInfo,
    RouterLink
  ],
  template: `
    <div class="media">
      <div class="media-vote">
        <vote-buttons
          [score]="entry.score"
          [vote]="entry.vote"
          [canVote]="!!currentUser"
          (onVote)="onButtonVote($event)">
        </vote-buttons>
      </div>
      <div class="media-left">
        <a href="#">
          <img
            class="media-object"
            style="width: 64px; height: 64px"
            [src]="entry.repository.owner.avatar_url"
          />
        </a>
      </div>
      <div class="media-body">
        <h4 class="media-heading">
          <a [href]="entry.repository.html_url">
            {{ entry.repository.full_name }}
          </a>
        </h4>
        <repo-info
          [fullName]="entry.repository.full_name"
          [description]="entry.repository.description"
          [stargazersCount]="entry.repository.stargazers_count"
          [openIssuesCount]="entry.repository.open_issues_count"
          [createdAt]="entry.createdAt"
          [userUrl]="entry.postedBy.html_url"
          [username]="entry.postedBy.login"
          [commentCount]="entry.commentCount">
        </repo-info>
      </div>
    </div>
  `
})
class FeedEntry {
  @Input() entry;
  @Input() currentUser;
  @Output() onVote: EventEmitter<onVoteEvent> = new EventEmitter();
  org: string;
  repoName: string;

  ngOnInit() {
    const parts = this.entry.repository.full_name.split('/');
    this.org = parts[0];
    this.repoName = parts[1];
  }

  onButtonVote(type: string): void {
    this.onVote.emit({
      repoFullName: this.entry.repository.full_name,
      type,
    });
  }
}

@Component({
  selector: 'feed',
  directives: [
    FeedEntry,
    Loading
  ],
  template: `
    <loading *ngIf="data.loading"></loading>
    <div *ngIf="!data.loading">
      <feed-entry
        *ngFor="let entry of data.feed"
        [entry]="entry"
        [currentUser]="data.currentUser"
        (onVote)="onVote($event)">
      </feed-entry>
    </div>
  `
})
@Apollo({
  client,
  queries(context: Feed) {
    return {
      data: {
        query: gql`
          query Feed($type: FeedType!) {
            currentUser {
              login
            }
            feed(type: $type) {
              createdAt
              ...scoreInfo
              commentCount
              id
              postedBy {
                login
                html_url
              }
              vote {
                vote_value
              }
              repository {
                name
                full_name
                description
                html_url
                stargazers_count
                open_issues_count
                created_at
                owner {
                  avatar_url
                }
              }
            }
          }
        `,
        variables: {
          type: context.type ? context.type.toUpperCase() : 'TOP'
        },
        forceFetch: true,
        fragments: scoreInfoFragment,
      }
    }
  },
  mutations(context: Feed) {
    return {
      vote: (repoFullName, type) => ({
        mutation: gql`
          mutation vote($repoFullName: String!, $type: VoteType!) {
            vote(repoFullName: $repoFullName, type: $type) {
              score
              id
              vote {
                vote_value
              }
            }
          }
        `,
        variables: {
          repoFullName,
          type,
        }
      })
    };
  }
})
export class Feed {
  data: any;
  type: string;
  vote: (repoFullName: string, type: string) => Promise<ApolloQueryResult>;

  constructor(params: RouteParams) {
    this.type = params.get('type');
  }

  onVote(event: onVoteEvent): void {
    this.vote(event.repoFullName, event.type);
  }
}
