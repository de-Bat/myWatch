export interface TmdbGenre {
  id: number
  name: string
}

export interface TmdbMovieResult {
  id: number
  media_type: 'movie'
  title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  genre_ids: number[]
  vote_average: number
  vote_count: number
}

export interface TmdbTvResult {
  id: number
  media_type: 'tv'
  name: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  first_air_date: string
  genre_ids: number[]
  vote_average: number
  vote_count: number
}

export type TmdbSearchResult = TmdbMovieResult | TmdbTvResult

export interface TmdbMovieDetail {
  id: number
  title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  genres: TmdbGenre[]
  vote_average: number
  vote_count: number
  runtime: number | null
  status: string
}

export interface TmdbTvDetail {
  id: number
  name: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  first_air_date: string
  genres: TmdbGenre[]
  vote_average: number
  vote_count: number
  episode_run_time: number[]
  number_of_seasons: number
  status: string
}

export interface TmdbPagedResponse<T> {
  results: T[]
  page: number
  total_pages: number
  total_results: number
}
