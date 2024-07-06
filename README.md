# Text to Image v5

This is a Node.js application that generates images based on user prompts by interfacing with the Magic Studio AI Art Generator API.

## Features

- **Generate Image**: Generate an image based on a user prompt and return the base64 encoded image.
- **Premium Users**: Generate an image based on a user prompt, save the image to the server, and provide a URL for the image. The image will be deleted after 2 minutes.
- **Serve Images**: Serve generated images from the server.

## Prerequisites

- Node.js (v12 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/yourusername/ai-image-generator.git
    cd ai-image-generator
    ```

2. Install the dependencies:

    ```bash
    npm install
    ```

3. Create an `images` directory in the root of the project:

    ```bash
    mkdir images
    ```

## Usage

1. Start the server:

    ```bash
    node app.js
    ```

2. The server will start on port 3000. You can access the endpoints using the following URLs:

    - **Generate Image**: `GET /generate?p=<prompt>`
    - **Premium Users**: `GET /image?p=<prompt>`
    - **Serve Images**: `GET /images/<filename>`

## Endpoints

### Generate Image

- **URL**: `/generate`
- **Method**: `GET`
- **Query Parameters**: 
  - `p`: The prompt for generating the image (required)

- **Response**: 
  - `200 OK`: `{ "img": "<base64_image_data>" }`
  - `400 Bad Request`: `{ "error": "Prompt is required" }`
  - `500 Internal Server Error`: `{ "error": "<error_message>" }`

### Premium Users

- **URL**: `/image`
- **Method**: `GET`
- **Query Parameters**: 
  - `p`: The prompt for generating the image (required)

- **Response**: 
  - `200 OK`: `{ "url": "/images/<filename>.png" }`
  - `400 Bad Request`: `{ "error": "No prompt provided" }`
  - `500 Internal Server Error`: `{ "error": "<error_message>" }`

### Serve Images

- **URL**: `/images/<filename>`
- **Method**: `GET`

- **Response**: 
  - `200 OK`: Returns the image file
  - `404 Not Found`: `{ "error": "Image not found" }`

## Dependencies

- [express](https://www.npmjs.com/package/express): Fast, unopinionated, minimalist web framework for Node.js
- [axios](https://www.npmjs.com/package/axios): Promise based HTTP client for the browser and Node.js
- [sharp](https://www.npmjs.com/package/sharp): High-performance image processing in Node.js
- [buffer](https://www.npmjs.com/package/buffer): The buffer module from node.js, for the browser
- [fs](https://nodejs.org/api/fs.html): Node.js file system module
- [path](https://nodejs.org/api/path.html): Node.js path module

