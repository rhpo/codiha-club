<!--
	One post in the feed: author, body, up to four images, like and comment
	counts. The whole card links through to the post's own page, where the
	comments live.
-->
<script>
  // @ts-nocheck
  import Fa from "svelte-fa";
  import {
    faHeart,
    faComment,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import { enhance } from "$app/forms";
  import Avatar from "$lib/components/Avatar.svelte";
  import { relative } from "$lib/utils.js";

  export let post;
  /** Shown only to whoever may remove it. */
  export let canDelete = false;
  /** The detail page renders the body in full; the feed clamps it. */
  export let full = false;

  /* Optimistic: the count moves on click rather than after the round trip,
	   because a like that takes a second to appear feels broken. */
  let liked = post.likedByMe;
  let likes = Number(post.like_count ?? 0);
  $: liked = post.likedByMe;
  $: likes = Number(post.like_count ?? 0);

  const toggle = () => {
    liked = !liked;
    likes += liked ? 1 : -1;
  };
</script>

<article class="post panel">
  <header>
    <Avatar src={post.author_avatar} name={post.author_name} size={40} />
    <div class="who">
      <strong>{post.author_name}</strong>
      <span class="tiny muted">{relative(post.created_at)}</span>
    </div>

    {#if canDelete}
      <form method="POST" action="?/remove" use:enhance>
        <input type="hidden" name="post_id" value={post.id} />
        <button class="icon-btn" type="submit" title="Delete this post">
          <Fa icon={faTrash} />
        </button>
      </form>
    {/if}
  </header>

  <p class="body" class:clamp={!full}>{post.body}</p>

  {#if post.images?.length}
    <!-- One image fills the width; two or more tile, so a single screenshot
		     is not shrunk into a thumbnail for no reason. -->
    <div class="shots" class:one={post.images.length === 1}>
      {#each post.images as src}
        <img {src} alt="" loading="lazy" />
      {/each}
    </div>
  {/if}

  <footer>
    <form method="POST" action="?/like" use:enhance>
      <input type="hidden" name="post_id" value={post.id} />
      <button
        class="act"
        class:on={liked}
        type="submit"
        on:click={toggle}
        title={liked ? "Undo like" : "Like this post"}
      >
        <Fa icon={faHeart} />
        {likes}
      </button>
    </form>

    <a class="act" href="/posts/{post.id}">
      <Fa icon={faComment} />
      {post.comment_count ?? 0}
    </a>
  </footer>
</article>

<style>
  .post {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .who {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
    min-width: 0;
    flex: 1;
  }

  .body {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .clamp {
    display: -webkit-box;
    -webkit-line-clamp: 8;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .shots {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem;
  }

  .shots.one {
    grid-template-columns: 1fr;
  }

  .shots img {
    width: 100%;
    max-height: 420px;
    object-fit: cover;
    border-radius: 10px;
    display: block;
    background: var(--glass);
  }

  footer {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .act {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.6rem;
    border-radius: 999px;
    border: 1px solid var(--glass-border);
    background: none;
    color: var(--muted);
    font-family: Inter, sans-serif;
    font-size: 0.82rem;
    cursor: var(--pointer, pointer);
    text-decoration: none;
  }

  .act:hover {
    color: var(--color-text);
    border-color: var(--glass-border-strong);
  }

  .act.on {
    color: var(--accent);
    border-color: var(--accent-line);
  }

  .icon-btn {
    background: none;
    border: 0;
    color: var(--muted-2);
    cursor: var(--pointer, pointer);
    padding: 0.2rem;
  }

  .icon-btn:hover {
    color: var(--accent);
  }
</style>
