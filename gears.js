
// window.onload = function() {
//     // Get a reference to the canvas object
//     var canvas = document.getElementById('paper-canvas');
//     canvas.width = document.body.clientWidth;
//     canvas.height = document.body.clientWidth;

//     // Create an empty project and a view for the canvas:
//     paper.setup(canvas);


// }


void setup()
{
    size(document.body.clientWidth, document.body.clientWidth);
    background(255);
};


// This is Conway's game of life. Press 'p' to pause! 
// For more information, check out the wikipedia page:
//   http://en.wikipedia.org/wiki/Conway's_Game_of_Life


// whether or not the simulation is paused
var paused = false;

// how many loop ticks before drawing again
var drawDelay = 8;

// size of the grid
var gridLength = 27;
var squareSize = 400 / gridLength;

// initialize a 2D array of cells
var cells = [];
for (var x = 0; x < gridLength; x += 1) {
    cells[x] = [];
    for (var y = 0; y < gridLength; y += 1) {
        cells[x][y] = 0;
    }
}
// initialize a 2D array of cells for the next generation
var nextGen = [];
for (var x = 0; x < gridLength; x += 1) {
    nextGen[x] = [];
    for (var y = 0; y < gridLength; y += 1) {
        nextGen[x][y] = 0;
    }
}

// initialize a "glider". Try picking different cells
// and see what happens!
cells[0][10] = 1;
cells[0][9] = 1;
cells[0][8] = 1;
cells[0][4] = 1;
cells[0][3] = 1;
cells[0][7] = 1;

// this function determines whether or not a cell lives on
// to the next generation
void livesOn(x, y)
{
    // first count the number of live neighbors
    var numNeighbors = 0;
    for (var i = -1; i <= 1; i +=1 ) {
        for (var j = -1; j <= 1; j += 1) {
            var neighborX = (x + i + gridLength) % gridLength;
            var neighborY = (y + j + gridLength) % gridLength;
            
            if (neighborX !== x || neighborY !== y) {
                if (cells[neighborX][neighborY] === 1) {
                    numNeighbors += 1;
                }
            }
            
        }
    }
    // if the cell is living and has 2 or 3 live neighbors...
    if (cells[x][y] === 1 &&
            (numNeighbors === 3 || numNeighbors === 2)) {
        return true;
    }
    // if the cell is dead and has exactly 3 neighbors...
    if (cells[x][y] === 0 && numNeighbors === 3) {
        return true;
    }
    // otherwise it's either overpopulated or underpopulated
    // and the cell is dead
    return false;
};

void nextGeneration()
{
    for (var x = 0; x < gridLength; x += 1) {
        for (var y = 0; y < gridLength; y += 1) {
            // set color and draw
            if (cells[x][y] === 1) {
                fill(199, 0, 209);
            }
            else {
                fill(255, 255, 255);
            }
            rect(x * squareSize, y * squareSize,
                    squareSize, squareSize);
            // build next generation array
            if(x === 0) {
                if (livesOn(x,y)) {
                    nextGen[x][y] = 1;
                }
                else {
                    nextGen[x][y] = 0;
                }
            }
            
            if(cells[(x - 1 + gridLength) % gridLength][y] === 1) {
                nextGen[x][y] = 1;
            } else {
                nextGen[x][y] = 0;
            }
        }
    }
    // copy next generation into current generation array
    for (var i = 0; i < gridLength; i += 1) {
        for (var j = 0; j < gridLength; j += 1) {
            cells[i][j] = nextGen[i][j];
        }
    }
};

// draw loop!
var t = 0;
void draw() {
    // to keep the animation from going too fast, only
    // draw after the specified delay
    if (t === drawDelay) {
        nextGeneration();
        t = 0;
    }
    // only increment t if we are not paused
    if (!paused) {
        t += 1;
    }
};

// add a live cell when you click on it
void mouseClicked() {
    var x = Math.floor(mouseX / squareSize);
    var y = Math.floor(mouseY / squareSize);
    cells[x][y] = 1;
    
    // draw the new cell
    fill(199, 0, 209);
    rect(x * squareSize, y * squareSize,
        squareSize, squareSize);
};

// do the same thing when you click and drag
void mouseDragged() {
    var x = Math.floor(mouseX / squareSize);
    var y = Math.floor(mouseY / squareSize);
    cells[x][y] = 1;

    // draw the new cell
    fill(199, 0, 209);
    rect(x * squareSize, y * squareSize,
        squareSize, squareSize);
};

void keyPressed() {
    // press 'p' to pause!
    if (keyCode === 80) {
        paused = !paused;
    }
};
