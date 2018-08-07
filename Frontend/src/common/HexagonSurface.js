import Cell from './Cell.js'
import { mapGetters } from 'vuex'
import { calcDistance } from './DistanceHelper.js'

const TRANSLATE_SCALE_FACTOR = 1.5
const DEFAULT_SCALE = 2.0
const MAX_RENDER_ZOOM = 2.0
const BIG_ZOOM = 4.0
const TO_POINT_SIZE = 3
const FROM_POINT_SIZE = 2
const ARROW_LINE_WIDTH = 1.25

export default {
  data () {
    return {
      arrowsMode: false,
      tickFlag: false,
      offsetDX: 0,
      degree: 2.0 / 3.0 * Math.PI,
      a: 0,
      dx: 0,
      dy: 0,
      context: undefined,
      scale: DEFAULT_SCALE,
      centeredIndex: -1,
      hoveredIndex: undefined,
      selectedIndex: -1,
      pending: {
        scale: 1.0,
        dx: 0,
        dy: 0
      },
      paused: true,
      mapSize: {
        width: 0,
        height: 0
      },
      frames: 0,
      fps: 0
    }
  },
  computed: {
    ...mapGetters({
      planetByCellID: 'planet',
      planetByID: 'planetByID',
      theBestPlanet: 'theBestPlanet',
      fleets: 'fleets/all',
      tasks: 'tasks/all',
      fleetsMaxShips: 'fleets/maxShipsCount',
      fullRender: 'settings/fullRender'
    }),
    simplyRender () {
      return (this.drag || this.scale < 1 / MAX_RENDER_ZOOM) && !this.fullRender
    },
    bigZoom () {
      return this.scale < 1 / BIG_ZOOM && !this.fullRender
    },
    renderedCount () {
      return this._active.length
    }
  },
  mounted () {
    this._all = []
    this._active = []

    this._fpsTimeout = undefined
    let fpsFunc = () => {
      this.fps = this.frames
      this.frames = 0
      this._fpsTimeout = setTimeout(fpsFunc, 1000)
    }
    fpsFunc()

    this._centeredAnimTimerFunc = () => {
      let cell = this._all[this.centeredIndex]
      if (cell) {
        cell.isCentered = !cell.isCentered
        cell.render(this.context, this.renderConfig(cell))
      }
      this._centeredAnimTimeout = setTimeout(this._centeredAnimTimerFunc, 350)
    }
    this._centeredAnimTimerFunc()
  },
  beforeDestroy () {
    this._all = []
    this._active = []
    clearTimeout(this._tickTimeout)
    clearTimeout(this._centeredAnimTimeout)
    clearTimeout(this._fpsTimeout)
  },
  methods: {
    renderConfig (cell) {
      let distance = -1
      if (cell.id === this.hoveredIndex + 1 &&
        this.selectedIndex !== -1) {
        distance = this.calculateDistance(this.selectedIndex + 1, cell.id)
      }
      return {
        stepsTo: distance,
        simply: this.simplyRender,
        simplyNoBorder: this.bigZoom,
        withoutDecreasing: this.renderWithoutDecreasing
      }
    },
    _drawArrows (arr) {
      this.context.save()
      Object.values(arr).forEach(fleet => {
        let from = this.planetByID(fleet.from)
        let to = this.planetByID(fleet.to)
        if (from !== undefined && to !== undefined) {
          let fromCell = this._all[from.cellID - 1]
          let toCell = this._all[to.cellID - 1]
          if (fromCell !== undefined && toCell !== undefined) {
            this._drawArrow(fromCell, toCell, fleet.count)
          }
        }
      })
      this.context.restore()
    },
    _drawArrow (from, to, count) {
      let opacity = Math.min(Math.max(0.1, count / this.fleetsMaxShips), 1.0)
      let fromPoint = from.center
      let toPoint = to.center
      let ctx = this.context
      // let zoom = this.scale * 1.25
      let zoom = 1.0
      ctx.beginPath()
      ctx.strokeStyle = 'rgba(255, 255, 255, ' + opacity + ')'
      ctx.lineWidth = ARROW_LINE_WIDTH / zoom
      ctx.fillStlte = 'transparent'
      ctx.moveTo(fromPoint.x, fromPoint.y)
      ctx.lineTo(toPoint.x, toPoint.y)
      ctx.stroke()
      ctx.beginPath()
      ctx.fillStyle = 'rgba(255, 255, 255, 1.0)'
      ctx.lineWidth = 1
      ctx.arc(toPoint.x, toPoint.y, TO_POINT_SIZE / zoom, 0, Math.PI * 2, true)
      ctx.fill()

      ctx.beginPath()
      ctx.strokeStlte = 'rgba(255, 255, 255, 1.0)'
      ctx.lineWidth = 1
      ctx.arc(fromPoint.x, fromPoint.y, FROM_POINT_SIZE / zoom, 0, Math.PI * 2, true)
      ctx.stroke()
    },
    _genSurface (a) {
      this._all = []
      for (let y = 0, count = 1; y < this.mapSize.height; ++y) {
        for (let x = 0; x < this.mapSize.width; ++x) {
          this._all.push(new Cell({ x, y }, this.$t, a, count++, this.degree))
        }
      }
    },
    _relPosCalculator () {
      let { width, height } = this.context.canvas
      let rect = this.context.canvas.getBoundingClientRect()
      let globScale = { // DOM
        x: width / rect.width,
        y: height / rect.height
      }
      return ({x, y}) => {
        x *= globScale.x
        y *= globScale.y

        x += -width * 0.5 * (1 - this.scale)
        x /= this.scale
        x -= this.dx

        y += -height * 0.5 * (1 - this.scale)
        y /= this.scale
        y -= this.dy

        return { x, y }
      }
    },
    selectCell (cellID) {
      this.unselectLastCell()
      this.selectedIndex = cellID
      this._switchCell(cellID, true)
    },
    unselectLastCell () {
      if (this.selectedIndex >= 0) {
        this._switchCell(this.selectedIndex, false)
        this.selectedIndex = -1
      }
    },
    _switchCell (cellID, selected) {
      let cell = this._all[cellID]
      cell.isSelected = selected
      cell.render(this.context, this.renderConfig(cell))
    },
    resolvePlanet ({ mx, my }) {
      let cell = this._resolveCell(this.context, { mx, my })
      if (cell === undefined) {
        return undefined
      }
      return this.planetByCellID(cell.id)
    },
    _resolveCell (ctx, {mx, my}) {
      let calc = this._relPosCalculator(ctx)
      let pos = calc({x: mx, y: my})
      return this._active.find(cell => cell.isPointOver(pos))
    },
    onSurfaceMouseMove ({ mx, my }) {
      if (this._moveLock) {
        return
      }
      this._moveLock = true

      if (this.hoveredIndex !== undefined) {
        let cell = this._all[this.hoveredIndex]
        this.hoveredIndex = undefined
        cell.isHovered = false
        cell.render(this.context, this.renderConfig(cell))
      }

      let cell = this._resolveCell(this.context, {mx, my})
      if (cell) {
        cell.isHovered = true
        this.hoveredIndex = cell.id - 1
        cell.render(this.context, this.renderConfig(cell))
      }
      this._moveLock = false
    },
    calculateDistance (cellFirst, cellSeoncd) {
      return calcDistance(cellFirst, cellSeoncd,
        this.$store.getters['game/info'].mapWidth)
    },
    pause () {
      this.paused = true
    },
    play () {
      this.paused = false
    },
    init (ctx, a, mapSizeWidth, mapSizeHeight, offsetX = 0) {
      this.a = a
      this.offsetDX = offsetX
      this.mapSize.width = mapSizeWidth
      this.mapSize.height = mapSizeHeight
      this.context = ctx
      this._genSurface(a)
      if (!this._tick) {
        this._tick = () => {
          if (!this.paused || this.tickFlag || this.arrowsMode) {
            this.tickFlag = false
            this.redraw(this.context)
          }
          this._tickTimeout = setTimeout(this._tick, 0)
        }
        this._tick()
      }
    },
    tick () {
      this.tickFlag = true
    },
    translateSurface ({dx, dy}, considerScale = false) {
      this.pending.dx += dx * (considerScale
        ? TRANSLATE_SCALE_FACTOR / this.scale : 1.0)
      this.pending.dy += dy * (considerScale
        ? TRANSLATE_SCALE_FACTOR / this.scale : 1.0)
      this.highlightCenterize(null)
    },
    scaleSurface (scale) {
      if (scale === 0) {
        this.scale = DEFAULT_SCALE
      } else {
        this.pending.scale *= scale
      }
      this.highlightCenterize(null)
    },
    goHome () {
      let p = this.theBestPlanet
      if (p) {
        return this.goToCell(p.cellID, false)
      }
      let firstCell = this._all[0]
      if (!firstCell) {
        return this.clearOffset()
      }
      let { width, height } = this.context.canvas
      this.dx = width / 2.0 -
        firstCell.relativeWidth * this.mapSize.width / 2.0 -
        this.offsetDX
      this.dy = height / 2.0 - firstCell.height * this.mapSize.height / 2.0
      this.scale = 1.0
      this.tick()
    },
    highlightCenterize (cellIndex) {
      let _highlightCenterize = (cI, centered) => {
        let cell = this._all[cI]
        if (cell) {
          cell.isCentered = centered
          cell.render(this.context, this.renderConfig(cell))
        }
      }
      _highlightCenterize(this.centeredIndex, false)
      _highlightCenterize(cellIndex, true)
      this.centeredIndex = cellIndex
    },
    goToCell (cellID, highlight = true) {
      let cell = this._all[cellID - 1]
      if (!cell) {
        return
      }
      this.scale = 2.0
      let { width, height } = this.context.canvas
      this.dx = -cell.startPoint.x +
      (width - cell.width) * 0.5 -
      this.offsetDX
      this.dy = -cell.startPoint.y + (height - cell.height) * 0.5
      this.tick()
      if (highlight) {
        this.highlightCenterize(cellID - 1)
      } else {
        this.highlightCenterize(null)
      }
    },
    _scaleOverCenter (ctx, scale) {
      let { width, height } = ctx.canvas
      let cx = width * 0.5
      let cy = height * 0.5
      ctx.translate(cx - this.dx, cy - this.dy)
      ctx.scale(scale, scale)
      ctx.translate(-cx + this.dx, -cy + this.dy)
    },
    clearOffset () {
      this.dx = 0
      this.dy = 0
      this.scale = 1.0
    },
    redraw (ctx) {
      let { scale, dx, dy } = this.pending
      this.pending = { scale: 1.0, dx: 0.0, dy: 0.0 }

      if (isNaN(scale)) { //
        scale = 1.0
      }

      this.dx += dx
      this.dy += dy
      this.scale *= scale

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      let { width, height } = ctx.canvas

      ctx.clearRect(0, 0, width, height) // slow
      ctx.translate(this.dx, this.dy)
      this._scaleOverCenter(ctx, this.scale)

      let realPosCalc = this._relPosCalculator()
      let rect = this.context.canvas.getBoundingClientRect()
      let visibilityOffset = this.a * this.scale
      let startPoint = realPosCalc({
        x: -visibilityOffset * 1.5,
        y: -visibilityOffset * 1.75
      })
      let endPoint = realPosCalc({
        x: rect.width + visibilityOffset,
        y: rect.height + visibilityOffset
      })

      this._active = this._all.filter(cell => {
        if (cell.firstPoint.x > startPoint.x &&
          cell.firstPoint.x < endPoint.x &&
          cell.firstPoint.y > startPoint.y &&
          cell.firstPoint.y < endPoint.y) {
          requestAnimationFrame(() => {
            cell.render(ctx, this.renderConfig(cell))
          })
          return true
        }
      })

      if (this.arrowsMode) {
        requestAnimationFrame(() => {
          this._drawArrows(this.fleets)
          this._drawArrows(this.tasks)
        })
      }
      this.frames++
    }
  }
}
