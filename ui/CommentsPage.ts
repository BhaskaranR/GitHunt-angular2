import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Apollo } from 'angular2-apollo';
import { TimeAgoPipe } from 'angular2-moment';
import { ApolloQueryResult } from 'apollo-client';

import { client } from './client.ts';
import { Loading } from './Loading.ts';
import { RepoInfo } from './RepoInfo.ts';

import gql from 'graphql-tag';

@Component({
  selector: 'comment',
  pipes: [
    TimeAgoPipe
  ],
  template: `
    <div class="comment-box">
      <b>{{content}}</b>
      <br />
      Submitted {{createdAt | amTimeAgo}} by <a [href]="userUrl">{{username}}</a>
    </div>
  `
})
class Comment {
  @Input() username: string;
  @Input() userUrl: string;
  @Input() content: string;
  @Input() createdAt: Date;
}

@Component({
  selector: 'comments-page',
  directives: [
    Loading,
    Comment,
    RepoInfo
  ],
  template: `
  <loading *ngIf="data.loading"></loading>
  <div *ngIf="!data.loading">
    <div>
      <h1>Comments for <a [href]="data.entry.repository.html_url">{{data.entry.repository.full_name}}</a></h1>
      <repo-info
        [fullName]="data.entry.repository.full_name"
        [description]="data.entry.repository.description"
        [stargazersCount]="data.entry.repository.stargazers_count"
        [openIssuesCount]="data.entry.repository.open_issues_count"
        [createdAt]="data.entry.createdAt"
        [userUrl]="data.entry.postedBy.html_url"
        [username]="data.entry.postedBy.login"
        [commentCount]="data.entry.commentCount">
      </repo-info>
      <form *ngIf="data.currentUser" (ngSubmit)="submitForm()">
          <div class="form-group">

            <input
              type="text"
              class="form-control"
              id="newComment"
              name="newCommentContent"
              [(ngModel)]="newComment"
              placeholder="Write your comment here!"
            />
          </div>

          <div *ngIf="submitComment.errors" class="alert alert-danger" role="alert">
            {{submitComment.errors[0].message}}
          </div>

          <div *ngIf="noCommentContent" class="alert alert-danger" role="alert">
            Comment must have content.
          </div>

          <button type="submit" class="btn btn-primary">
            Submit
          </button>
        </form>
        <div *ngIf="!data.currentUser"><em>Log in to comment.</em></div>
      </div>
      <br />
      <div *ngIf="data.entry.comments">
        <comment
          *ngFor="let comment of data.entry.comments"
          [username]="comment.postedBy.login"
          [content]="comment.content"
          [createdAt]="comment.createdAt"
          [userUrl]="comment.postedBy.html_url">
        </comment>
      </div>
    </div>
  `
})
@Apollo({
  client,
  queries(context: CommentsPage) {
    return {
      data: {
        query: gql`
          query Comment($repoName: String!) {
            # Eventually move this into a no fetch query right on the entry
            # since we literally just need this info to determine whether to
            # show upvote/downvote buttons
            currentUser {
              login
              html_url
            }
            entry(repoFullName: $repoName) {
              id
              postedBy {
                login
                html_url
              }
              createdAt
              comments {
                postedBy {
                  login
                  html_url
                }
                createdAt
                content
              }
              repository {
                full_name
                html_url
                description
                open_issues_count
                stargazers_count
              }
            }
          }
        `,
        variables: {
          repoName: `${context.org}/${context.repoName}`,
        },
      },
    };
  },
  mutations(context: CommentsPage) {
    return {
      submitComment: (repoFullName, repoId, commentContent, currentUser) => ({
        mutation: gql`
          mutation submitComment($repoFullName: String!, $commentContent: String!) {
            submitComment(repoFullName: $repoFullName, commentContent: $commentContent) {
              postedBy {
                login
                html_url
              }
              createdAt
              content
            }
          }
        `,
        variables: {
          repoFullName,
          commentContent,
        },
        optimisticResponse: {
         __typename: 'Mutation',
         submitComment: {
           __typename: 'Comment',
           postedBy: currentUser,
           createdAt: +new Date,
           content: commentContent,
         },
       },
       resultBehaviors: [
         {
           type: 'ARRAY_INSERT',
           resultPath: [ 'submitComment' ],
           storePath: [ 'Entry' + repoId, 'comments' ],
           where: 'PREPEND',
         },
       ],
     }),
    };
  },
})
export class CommentsPage implements OnInit {
  org: string;
  repoName: string;
  data: any;
  newComment: string;
  noCommentContent: boolean;
  submitComment: (
      repoFullName: string,
      repoId: string,
      commentContent: string,
      currentUser: string
    ) => Promise<ApolloQueryResult>;

  constructor(private route: ActivatedRoute) {
    this.noCommentContent = false;
  }

  ngOnInit() {
    this.route.params
      .subscribe(params => {
        this.org = params['org'];
        this.repoName = params['repoName'];
      });
  }

  submitForm() {
    this.noCommentContent = false;

    const repositoryName = this.data.entry.repository.full_name;
    const repoId = this.data.entry.id;
    const currentUser = this.data.currentUser;

    if (!this.newComment) {
      this.noCommentContent = true;
    } else {
      this.submitComment(repositoryName, repoId, this.newComment, currentUser).then(() => {
        this.newComment = '';
      });
    }
  }
}
