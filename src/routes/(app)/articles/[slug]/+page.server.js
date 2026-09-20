// make it return data { article }

import { articles } from '$lib/data/articles.js';
import { error } from '@sveltejs/kit';
import { marked } from 'marked';

export async function load({ params }) {
    console.log(params.slug, articles);
    const article = articles.find((a) => a.id === params.slug);

    if (article) {

        if (article.content) {
            article.content = await marked(article.content);
        }

        return { article };
    } else {
        throw error(404, 'Article not found');
        return { article: null }
    }
}
